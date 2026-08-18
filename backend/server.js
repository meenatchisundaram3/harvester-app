import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { initDb } from './db.js';
import apiRouter from './routes.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5000;

// Enable CORS
app.use(cors());

// Configure JSON limits to accept large sync payloads with base64 offline images
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Serve static uploads
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Register API Routes
app.use('/api', apiRouter);

// Basic Health Check route
app.get('/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// Serve production frontend PWA build
const frontendDist = path.join(__dirname, '../frontend/dist');
app.use(express.static(frontendDist));
app.get('*', (req, res) => {
  if (!req.path.startsWith('/api') && !req.path.startsWith('/uploads')) {
    res.sendFile(path.join(frontendDist, 'index.html'));
  }
});

// Start Server and Initialize DB
const startServer = async () => {
  try {
    await initDb();
    
    app.listen(PORT, () => {
      console.log(`================================================`);
      console.log(` Harvester Owner Server Running on Port: ${PORT}`);
      console.log(` Health Check: http://localhost:${PORT}/health`);
      console.log(`================================================`);
    });
  } catch (err) {
    console.error('Fatal: Server failed to start:', err);
    process.exit(1);
  }
};

startServer();
