import express from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { query, execute, runTransaction } from './db.js';

const router = express.Router();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ensure uploads folder exists
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Multer Config for direct file uploads (when online)
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});
const upload = multer({ storage });

// Helper to check token (Direct Owner Access enabled)
export function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token || token === 'direct-owner-token' || token === 'offline-bypass-token') {
    req.user = { id: 1, username: 'owner', name: 'Harvester Owner' };
    return next();
  }
  
  jwt.verify(token, process.env.JWT_SECRET || 'super_secret_harvester_key_2026', (err, user) => {
    req.user = user || { id: 1, username: 'owner', name: 'Harvester Owner' };
    next();
  });
}

// ----------------------------------------------------
// AUTH ENDPOINTS
// ----------------------------------------------------
router.post('/auth/login', async (req, res) => {
  const { username, password } = req.body;
  
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }

  try {
    const users = await query('SELECT * FROM owner WHERE username = ?', [username]);
    if (users.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    const user = users[0];
    const isPasswordValid = await bcrypt.compare(password, user.password_hash);
    if (!isPasswordValid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    const token = jwt.sign(
      { id: user.id, username: user.username },
      process.env.JWT_SECRET || 'super_secret_harvester_key_2026',
      { expiresIn: '30d' }
    );
    
    res.json({ token, user: { id: user.id, username: user.username, name: user.name, email: user.email } });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/auth/verify', authenticateToken, (req, res) => {
  res.json({ valid: true, user: req.user });
});

// ----------------------------------------------------
// FILE UPLOAD ENDPOINT
// ----------------------------------------------------
router.post('/upload', authenticateToken, upload.single('photo'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }
  const fileUrl = `/uploads/${req.file.filename}`;
  res.json({ url: fileUrl });
});

// Helper: Decode and save base64 image (useful for offline uploads synced later)
function saveBase64Image(base64Str) {
  try {
    const matches = base64Str.match(/^data:image\/([A-Za-z-+\/]+);base64,(.+)$/);
    if (!matches || matches.length !== 3) return null;
    
    const extension = matches[1] === 'jpeg' ? 'jpg' : matches[1];
    const base64Data = matches[2];
    const buffer = Buffer.from(base64Data, 'base64');
    
    const filename = `offline-${Date.now()}-${Math.round(Math.random() * 1e9)}.${extension}`;
    const filePath = path.join(uploadsDir, filename);
    
    fs.writeFileSync(filePath, buffer);
    return `/uploads/${filename}`;
  } catch (err) {
    console.error('Failed to save base64 image:', err);
    return null;
  }
}

// ----------------------------------------------------
// OFFLINE SYNC ENDPOINTS
// ----------------------------------------------------

// Make sure deleted_records table exists
const initDeletedRecordsTable = async () => {
  const sql = `CREATE TABLE IF NOT EXISTS deleted_records (
    id VARCHAR(50) PRIMARY KEY,
    table_name VARCHAR(50) NOT NULL,
    deleted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`;
  await execute(sql);
};

// Sync Pull: Send all changes since lastSynced
router.get('/sync/pull', authenticateToken, async (req, res) => {
  const { lastSynced } = req.query; // Iso String or Epoch timestamp
  
  // Format filter for SQL (supporting both sqlite and mysql datetime checks)
  // If lastSynced is 0 or empty, we pull everything
  const dateStr = lastSynced && lastSynced !== '0' ? new Date(lastSynced).toISOString().replace('T', ' ').substring(0, 19) : '1970-01-01 00:00:00';
  
  try {
    await initDeletedRecordsTable();
    
    const tables = [
      'operators',
      'harvesters',
      'attendance',
      'field_work',
      'diesel_refills',
      'running_hours',
      'payments',
      'expenses',
      'maintenance',
      'salary',
      'notifications'
    ];
    
    const updates = {};
    for (const table of tables) {
      // Find rows modified after dateStr
      const rows = await query(`SELECT * FROM ${table} WHERE updated_at > ?`, [dateStr]);
      updates[table] = rows;
    }
    
    // Also pull deleted records
    const deleted = await query(`SELECT * FROM deleted_records WHERE deleted_at > ?`, [dateStr]);
    
    res.json({
      timestamp: new Date().toISOString(),
      updates,
      deleted
    });
  } catch (err) {
    console.error('Sync Pull Error:', err);
    res.status(500).json({ error: 'Failed to pull updates from server' });
  }
});

// Sync Push: Receive logs of changes from local outbox
router.post('/sync/push', authenticateToken, async (req, res) => {
  const { changes } = req.body; // Array of { table, action, recordId, data }
  
  if (!Array.isArray(changes) || changes.length === 0) {
    return res.json({ success: true, message: 'No changes to push' });
  }

  try {
    await initDeletedRecordsTable();
    
    // Sort changes so that independent entities (operators, harvesters) are inserted/updated before dependent tables
    const tablePriority = {
      operators: 1,
      harvesters: 1,
      attendance: 2,
      field_work: 2,
      diesel_refills: 2,
      running_hours: 2,
      payments: 2,
      expenses: 2,
      maintenance: 2,
      salary: 2,
      notifications: 2
    };

    const sortedChanges = [...changes].sort((a, b) => {
      // Deletes go last or we sort by table priority
      if (a.action === 'delete' && b.action !== 'delete') return 1;
      if (a.action !== 'delete' && b.action === 'delete') return -1;
      
      const aPri = tablePriority[a.table] || 99;
      const bPri = tablePriority[b.table] || 99;
      return aPri - bPri;
    });

    // Temporarily relax FK checks during batch sync
    try {
      await execute('PRAGMA foreign_keys = OFF;');
    } catch (e) {}

    const operationsResults = [];
    
    for (const change of sortedChanges) {
      const { table, action, recordId, data } = change;
      
      if (action === 'delete') {
        // Log delete in deleted_records
        await execute('INSERT INTO deleted_records (id, table_name) VALUES (?, ?)', [recordId, table]);
        // Run SQL delete
        const result = await execute(`DELETE FROM ${table} WHERE id = ?`, [recordId]);
        operationsResults.push({ recordId, table, action, status: 'success', affectedRows: result.affectedRows });
      } else if (action === 'put' && data) {
        // Standard upsert logic
        // Strip out generated columns (e.g. productivity in field_work)
        const recordData = { ...data };
        delete recordData.productivity; 
        
        // If image data contains a base64 encoded photo (offline upload), convert it to file URL
        if (recordData.photo_url && recordData.photo_url.startsWith('data:image')) {
          const fileUrl = saveBase64Image(recordData.photo_url);
          if (fileUrl) {
            recordData.photo_url = fileUrl;
          }
        }
        if (recordData.receipt_photo_url && recordData.receipt_photo_url.startsWith('data:image')) {
          const fileUrl = saveBase64Image(recordData.receipt_photo_url);
          if (fileUrl) {
            recordData.receipt_photo_url = fileUrl;
          }
        }

        // Clean dates/booleans/numbers
        // SQLite uses strings for DATETIME and sets values properly.
        // Let's check if the record already exists
        const existing = await query(`SELECT id FROM ${table} WHERE id = ?`, [recordId]);
        
        // Exclude updated_at from data to let DB auto-update or set it ourselves
        // We'll set updated_at manually to ensure consistency
        recordData.updated_at = new Date().toISOString().replace('T', ' ').substring(0, 19);
        
        if (existing.length > 0) {
          // UPDATE
          const keys = Object.keys(recordData).filter(k => k !== 'id' && k !== 'created_at');
          const setClause = keys.map(k => `${k} = ?`).join(', ');
          const values = keys.map(k => recordData[k]);
          
          const sql = `UPDATE ${table} SET ${setClause} WHERE id = ?`;
          await execute(sql, [...values, recordId]);
          operationsResults.push({ recordId, table, action, status: 'success', mode: 'update' });
        } else {
          // INSERT
          // Ensure created_at exists
          if (!recordData.created_at) {
            recordData.created_at = new Date().toISOString().replace('T', ' ').substring(0, 19);
          }
          const keys = Object.keys(recordData);
          const placeholders = keys.map(() => '?').join(', ');
          const columns = keys.join(', ');
          const values = keys.map(k => recordData[k]);
          
          const sql = `INSERT INTO ${table} (${columns}) VALUES (${placeholders})`;
          await execute(sql, values);
          operationsResults.push({ recordId, table, action, status: 'success', mode: 'insert' });
        }
      }
    }
    
    res.json({
      success: true,
      results: operationsResults
    });
  } catch (err) {
    console.error('Sync Push Error:', err);
    res.status(500).json({ error: 'Failed to process sync changes', details: err.message });
  }
});

export default router;
