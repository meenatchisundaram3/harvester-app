import mysql from 'mysql2/promise';
import { DatabaseSync } from 'node:sqlite';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbType = process.env.DB_TYPE || 'sqlite';
let mysqlPool = null;
let sqliteDb = null;

// Initialize Database connection
export async function initDb() {
  if (dbType === 'mysql') {
    try {
      console.log('Connecting to MySQL Database...');
      mysqlPool = mysql.createPool({
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT || '3306'),
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'harvester_db',
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0
      });
      
      // Test connection
      await mysqlPool.query('SELECT 1');
      console.log('Successfully connected to MySQL database.');
      
      // Initialize schemas
      await createMySQLSchema();
    } catch (err) {
      console.error('MySQL connection failed. Falling back to built-in SQLite database. Error:', err.message);
      setupSQLite();
    }
  } else {
    setupSQLite();
  }

  // Seed default owner account if empty
  await seedOwnerAccount();
  await seedVehicles();
}

function setupSQLite() {
  console.log('Initializing SQLite Database...');
  const dbPath = path.join(__dirname, 'harvester.db');
  sqliteDb = new DatabaseSync(dbPath);
  console.log(`SQLite database successfully loaded at: ${dbPath}`);
  createSQLiteSchema();
}

// Unified Query Execution Methods
export async function query(sql, params = []) {
  if (sqliteDb) {
    try {
      const stmt = sqliteDb.prepare(sql);
      return stmt.all(...params);
    } catch (err) {
      console.error('SQLite query error:', err, 'SQL:', sql, 'Params:', params);
      throw err;
    }
  } else if (mysqlPool) {
    try {
      const [rows] = await mysqlPool.query(sql, params);
      return rows;
    } catch (err) {
      console.error('MySQL query error:', err, 'SQL:', sql, 'Params:', params);
      throw err;
    }
  } else {
    throw new Error('Database not initialized.');
  }
}

export async function execute(sql, params = []) {
  if (sqliteDb) {
    try {
      const stmt = sqliteDb.prepare(sql);
      const result = stmt.run(...params);
      return {
        insertId: result.lastInsertRowid,
        affectedRows: result.changes
      };
    } catch (err) {
      console.error('SQLite execution error:', err, 'SQL:', sql, 'Params:', params);
      throw err;
    }
  } else if (mysqlPool) {
    try {
      const [result] = await mysqlPool.execute(sql, params);
      return {
        insertId: result.insertId,
        affectedRows: result.affectedRows
      };
    } catch (err) {
      console.error('MySQL execution error:', err, 'SQL:', sql, 'Params:', params);
      throw err;
    }
  } else {
    throw new Error('Database not initialized.');
  }
}

// Transaction Wrapper helper
export async function runTransaction(operations) {
  if (sqliteDb) {
    // SQLite doesn't require complex connection pools. Run simple statements.
    try {
      sqliteDb.exec('BEGIN TRANSACTION;');
      const results = [];
      for (const op of operations) {
        const res = await execute(op.sql, op.params);
        results.push(res);
      }
      sqliteDb.exec('COMMIT;');
      return results;
    } catch (err) {
      sqliteDb.exec('ROLLBACK;');
      throw err;
    }
  } else if (mysqlPool) {
    const connection = await mysqlPool.getConnection();
    try {
      await connection.beginTransaction();
      const results = [];
      for (const op of operations) {
        const [res] = await connection.execute(op.sql, op.params);
        results.push({
          insertId: res.insertId,
          affectedRows: res.affectedRows
        });
      }
      await connection.commit();
      return results;
    } catch (err) {
      await connection.rollback();
      throw err;
    } finally {
      connection.release();
    }
  } else {
    throw new Error('Database not initialized.');
  }
}

// Create MySQL Schemas
async function createMySQLSchema() {
  const tables = [
    `CREATE TABLE IF NOT EXISTS owner (
        id INT AUTO_INCREMENT PRIMARY KEY,
        username VARCHAR(100) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        name VARCHAR(100),
        email VARCHAR(100),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS operators (
        id VARCHAR(50) PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        mobile VARCHAR(20) NOT NULL,
        address TEXT,
        aadhaar VARCHAR(20),
        license VARCHAR(50),
        joining_date DATE,
        salary_type ENUM('Monthly', 'Daily', 'Per Ton') NOT NULL,
        salary_amount DECIMAL(10,2) NOT NULL,
        status ENUM('Active', 'Inactive') DEFAULT 'Active',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_operator_status (status)
    )`,
    `CREATE TABLE IF NOT EXISTS harvesters (
        id VARCHAR(50) PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        model VARCHAR(100),
        serial_number VARCHAR(100) UNIQUE,
        purchase_date DATE,
        status ENUM('Active', 'Maintenance', 'Inactive') DEFAULT 'Active',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS attendance (
        id VARCHAR(50) PRIMARY KEY,
        date DATE NOT NULL,
        operator_id VARCHAR(50) NOT NULL,
        status ENUM('Present', 'Absent', 'Half Day', 'Leave') NOT NULL,
        start_time TIME,
        end_time TIME,
        working_hours DECIMAL(5,2) DEFAULT 0.00,
        overtime DECIMAL(5,2) DEFAULT 0.00,
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (operator_id) REFERENCES operators(id) ON DELETE CASCADE,
        UNIQUE KEY uq_attendance (date, operator_id),
        INDEX idx_attendance_date (date)
    )`,
    `CREATE TABLE IF NOT EXISTS field_work (
        id VARCHAR(50) PRIMARY KEY,
        date DATE NOT NULL,
        village VARCHAR(100) NOT NULL,
        farmer_name VARCHAR(100) NOT NULL,
        farmer_mobile VARCHAR(20),
        sugar_mill VARCHAR(100) NOT NULL,
        work_order_number VARCHAR(50),
        harvester_id VARCHAR(50) NOT NULL,
        operator_id VARCHAR(50) NOT NULL,
        start_time TIME,
        end_time TIME,
        running_hours DECIMAL(5,2) DEFAULT 0.00,
        idle_hours DECIMAL(5,2) DEFAULT 0.00,
        breakdown_hours DECIMAL(5,2) DEFAULT 0.00,
        distance_travelled DECIMAL(6,2) DEFAULT 0.00,
        tons_harvested DECIMAL(6,2) DEFAULT 0.00,
        rate_per_ton DECIMAL(8,2) DEFAULT 350.00,
        notes TEXT,
        photo_url VARCHAR(255),
        productivity DECIMAL(5,2) GENERATED ALWAYS AS (CASE WHEN running_hours > 0 THEN (tons_harvested / running_hours) ELSE 0 END) STORED,
        income DECIMAL(10,2) DEFAULT 0.00,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (harvester_id) REFERENCES harvesters(id),
        FOREIGN KEY (operator_id) REFERENCES operators(id),
        INDEX idx_field_work_date (date),
        INDEX idx_field_work_village (village),
        INDEX idx_field_work_farmer (farmer_name)
    )`,
    `CREATE TABLE IF NOT EXISTS diesel_refills (
        id VARCHAR(50) PRIMARY KEY,
        date DATE NOT NULL,
        harvester_id VARCHAR(50) NOT NULL,
        operator_id VARCHAR(50) NOT NULL,
        fuel_station VARCHAR(100),
        liters DECIMAL(6,2) NOT NULL,
        price_per_liter DECIMAL(6,2) NOT NULL,
        total_cost DECIMAL(10,2) NOT NULL,
        odometer DECIMAL(10,2),
        receipt_photo_url VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (harvester_id) REFERENCES harvesters(id),
        FOREIGN KEY (operator_id) REFERENCES operators(id),
        INDEX idx_diesel_date (date)
    )`,
    `CREATE TABLE IF NOT EXISTS running_hours (
        id VARCHAR(50) PRIMARY KEY,
        date DATE NOT NULL,
        harvester_id VARCHAR(50) NOT NULL,
        start_time TIME NOT NULL,
        stop_time TIME NOT NULL,
        running_hours DECIMAL(5,2) NOT NULL,
        idle_hours DECIMAL(5,2) DEFAULT 0.00,
        breakdown_hours DECIMAL(5,2) DEFAULT 0.00,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (harvester_id) REFERENCES harvesters(id),
        INDEX idx_running_hours_date (date)
    )`,
    `CREATE TABLE IF NOT EXISTS payments (
        id VARCHAR(50) PRIMARY KEY,
        mill_name VARCHAR(100) NOT NULL,
        date DATE NOT NULL,
        farmer VARCHAR(100) NOT NULL,
        village VARCHAR(100),
        tons DECIMAL(6,2) NOT NULL,
        rate_per_ton DECIMAL(8,2) NOT NULL,
        gross_amount DECIMAL(10,2) NOT NULL,
        advance DECIMAL(10,2) DEFAULT 0.00,
        balance DECIMAL(10,2) NOT NULL,
        payment_date DATE,
        status ENUM('Pending', 'Partial', 'Paid') DEFAULT 'Pending',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_payments_status (status),
        INDEX idx_payments_mill (mill_name)
    )`,
    `CREATE TABLE IF NOT EXISTS expenses (
        id VARCHAR(50) PRIMARY KEY,
        date DATE NOT NULL,
        category ENUM('Diesel', 'Repairs', 'Spare Parts', 'Engine Oil', 'Hydraulic Oil', 'Grease', 'Salary', 'Food', 'Transport', 'Other') NOT NULL,
        amount DECIMAL(10,2) NOT NULL,
        notes TEXT,
        ref_id VARCHAR(50),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_expenses_date (date),
        INDEX idx_expenses_category (category)
    )`,
    `CREATE TABLE IF NOT EXISTS maintenance (
        id VARCHAR(50) PRIMARY KEY,
        harvester_id VARCHAR(50) NOT NULL,
        date DATE NOT NULL,
        service_type ENUM('Engine Oil Change', 'Hydraulic Oil', 'Air Filter', 'Fuel Filter', 'Greasing', 'Battery Check', 'Insurance Expiry', 'RC Expiry') NOT NULL,
        service_date DATE NOT NULL,
        next_due_date DATE NOT NULL,
        odometer DECIMAL(10,2),
        cost DECIMAL(10,2) DEFAULT 0.00,
        notes TEXT,
        status ENUM('Completed', 'Pending') DEFAULT 'Pending',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (harvester_id) REFERENCES harvesters(id),
        INDEX idx_maintenance_due (next_due_date)
    )`,
    `CREATE TABLE IF NOT EXISTS salary (
        id VARCHAR(50) PRIMARY KEY,
        operator_id VARCHAR(50) NOT NULL,
        month TINYINT NOT NULL,
        year INT NOT NULL,
        attendance_count INT DEFAULT 0,
        working_hours DECIMAL(6,2) DEFAULT 0.00,
        overtime_hours DECIMAL(6,2) DEFAULT 0.00,
        salary_type ENUM('Monthly', 'Daily', 'Per Ton') NOT NULL,
        salary_amount DECIMAL(10,2) NOT NULL,
        deductions DECIMAL(10,2) DEFAULT 0.00,
        net_salary DECIMAL(10,2) NOT NULL,
        payment_date DATE,
        status ENUM('Paid', 'Pending') DEFAULT 'Pending',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (operator_id) REFERENCES operators(id),
        UNIQUE KEY uq_salary_operator_month (operator_id, month, year)
    )`,
    `CREATE TABLE IF NOT EXISTS notifications (
        id VARCHAR(50) PRIMARY KEY,
        type ENUM('Maintenance', 'Expiry', 'System') NOT NULL,
        title VARCHAR(150) NOT NULL,
        message TEXT NOT NULL,
        date DATE NOT NULL,
        is_read BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_notifications_unread (is_read)
    )`
  ];

  for (const tableQuery of tables) {
    await mysqlPool.query(tableQuery);
  }
}

// Create SQLite Schemas
function createSQLiteSchema() {
  const tables = [
    `CREATE TABLE IF NOT EXISTS owner (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        name TEXT,
        email TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS operators (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        mobile TEXT NOT NULL,
        address TEXT,
        aadhaar TEXT,
        license TEXT,
        joining_date TEXT,
        salary_type TEXT CHECK(salary_type IN ('Monthly', 'Daily', 'Per Ton')) NOT NULL,
        salary_amount REAL NOT NULL,
        status TEXT DEFAULT 'Active' CHECK(status IN ('Active', 'Inactive')),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS harvesters (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        model TEXT,
        serial_number TEXT UNIQUE,
        purchase_date TEXT,
        status TEXT DEFAULT 'Active' CHECK(status IN ('Active', 'Maintenance', 'Inactive')),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS attendance (
        id TEXT PRIMARY KEY,
        date TEXT NOT NULL,
        operator_id TEXT NOT NULL,
        status TEXT CHECK(status IN ('Present', 'Absent', 'Half Day', 'Leave')) NOT NULL,
        start_time TEXT,
        end_time TEXT,
        working_hours REAL DEFAULT 0.00,
        overtime REAL DEFAULT 0.00,
        notes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (operator_id) REFERENCES operators(id) ON DELETE CASCADE,
        UNIQUE(date, operator_id)
    )`,
    `CREATE TABLE IF NOT EXISTS field_work (
        id TEXT PRIMARY KEY,
        date TEXT NOT NULL,
        village TEXT NOT NULL,
        farmer_name TEXT NOT NULL,
        farmer_mobile TEXT,
        sugar_mill TEXT NOT NULL,
        work_order_number TEXT,
        harvester_id TEXT NOT NULL,
        operator_id TEXT NOT NULL,
        start_time TEXT,
        end_time TEXT,
        running_hours REAL DEFAULT 0.00,
        idle_hours REAL DEFAULT 0.00,
        breakdown_hours REAL DEFAULT 0.00,
        distance_travelled REAL DEFAULT 0.00,
        tons_harvested REAL DEFAULT 0.00,
        rate_per_ton REAL DEFAULT 350.00,
        notes TEXT,
        photo_url TEXT,
        productivity REAL GENERATED ALWAYS AS (CASE WHEN running_hours > 0 THEN (tons_harvested / running_hours) ELSE 0 END) STORED,
        income REAL DEFAULT 0.00,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (harvester_id) REFERENCES harvesters(id),
        FOREIGN KEY (operator_id) REFERENCES operators(id)
    )`,
    `CREATE TABLE IF NOT EXISTS diesel_refills (
        id TEXT PRIMARY KEY,
        date TEXT NOT NULL,
        harvester_id TEXT NOT NULL,
        operator_id TEXT NOT NULL,
        fuel_station TEXT,
        liters REAL NOT NULL,
        price_per_liter REAL NOT NULL,
        total_cost REAL NOT NULL,
        odometer REAL,
        receipt_photo_url TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (harvester_id) REFERENCES harvesters(id),
        FOREIGN KEY (operator_id) REFERENCES operators(id)
    )`,
    `CREATE TABLE IF NOT EXISTS running_hours (
        id TEXT PRIMARY KEY,
        date TEXT NOT NULL,
        harvester_id TEXT NOT NULL,
        start_time TEXT NOT NULL,
        stop_time TEXT NOT NULL,
        running_hours REAL NOT NULL,
        idle_hours REAL DEFAULT 0.00,
        breakdown_hours REAL DEFAULT 0.00,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (harvester_id) REFERENCES harvesters(id)
    )`,
    `CREATE TABLE IF NOT EXISTS payments (
        id TEXT PRIMARY KEY,
        mill_name TEXT NOT NULL,
        date TEXT NOT NULL,
        farmer TEXT NOT NULL,
        village TEXT,
        tons REAL NOT NULL,
        rate_per_ton REAL NOT NULL,
        gross_amount REAL NOT NULL,
        advance REAL DEFAULT 0.00,
        balance REAL NOT NULL,
        payment_date TEXT,
        status TEXT DEFAULT 'Pending' CHECK(status IN ('Pending', 'Partial', 'Paid')),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS expenses (
        id TEXT PRIMARY KEY,
        date TEXT NOT NULL,
        category TEXT CHECK(category IN ('Diesel', 'Repairs', 'Spare Parts', 'Engine Oil', 'Hydraulic Oil', 'Grease', 'Salary', 'Food', 'Transport', 'Other')) NOT NULL,
        amount REAL NOT NULL,
        notes TEXT,
        ref_id TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS maintenance (
        id TEXT PRIMARY KEY,
        harvester_id TEXT NOT NULL,
        date TEXT NOT NULL,
        service_type TEXT CHECK(service_type IN ('Engine Oil Change', 'Hydraulic Oil', 'Air Filter', 'Fuel Filter', 'Greasing', 'Battery Check', 'Insurance Expiry', 'RC Expiry')) NOT NULL,
        service_date TEXT NOT NULL,
        next_due_date TEXT NOT NULL,
        odometer REAL,
        cost REAL DEFAULT 0.00,
        notes TEXT,
        status TEXT DEFAULT 'Pending' CHECK(status IN ('Completed', 'Pending')),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (harvester_id) REFERENCES harvesters(id)
    )`,
    `CREATE TABLE IF NOT EXISTS salary (
        id TEXT PRIMARY KEY,
        operator_id TEXT NOT NULL,
        month INTEGER NOT NULL,
        year INTEGER NOT NULL,
        attendance_count INTEGER DEFAULT 0,
        working_hours REAL DEFAULT 0.00,
        overtime_hours REAL DEFAULT 0.00,
        salary_type TEXT CHECK(salary_type IN ('Monthly', 'Daily', 'Per Ton')) NOT NULL,
        salary_amount REAL NOT NULL,
        deductions REAL DEFAULT 0.00,
        net_salary REAL NOT NULL,
        payment_date TEXT,
        status TEXT DEFAULT 'Paid' CHECK(status IN ('Paid', 'Pending')),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (operator_id) REFERENCES operators(id),
        UNIQUE(operator_id, month, year)
    )`,
    `CREATE TABLE IF NOT EXISTS notifications (
        id TEXT PRIMARY KEY,
        type TEXT CHECK(type IN ('Maintenance', 'Expiry', 'System')) NOT NULL,
        title TEXT NOT NULL,
        message TEXT NOT NULL,
        date TEXT NOT NULL,
        is_read INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`
  ];

  for (const tableQuery of tables) {
    sqliteDb.exec(tableQuery);
  }

  // Column migrations for SQLite tables
  const migrations = [
    `ALTER TABLE payments ADD COLUMN payment_mode TEXT;`,
    `ALTER TABLE payments ADD COLUMN reference_no TEXT;`,
    `ALTER TABLE payments ADD COLUMN bill_no TEXT;`,
    `ALTER TABLE payments ADD COLUMN division TEXT;`,
    `ALTER TABLE payments ADD COLUMN period_from TEXT;`,
    `ALTER TABLE payments ADD COLUMN period_to TEXT;`,
    `ALTER TABLE payments ADD COLUMN deductions REAL DEFAULT 0.00;`,
    `ALTER TABLE payments ADD COLUMN net_payable REAL DEFAULT 0.00;`,
    `ALTER TABLE payments ADD COLUMN bank_details TEXT;`,
    `ALTER TABLE payments ADD COLUMN items TEXT;`,
    `ALTER TABLE payments ADD COLUMN pdf_url TEXT;`,
    `ALTER TABLE operators ADD COLUMN role TEXT;`,
    `ALTER TABLE operators ADD COLUMN assigned_vehicle TEXT;`,
    `ALTER TABLE expenses ADD COLUMN payment_mode TEXT;`
  ];
  for (const m of migrations) {
    try {
      sqliteDb.exec(m);
    } catch (e) {
      // Column already exists or table not ready, ignore
    }
  }
}

// Seed Initial Owner Account
async function seedOwnerAccount() {
  const users = await query('SELECT * FROM owner LIMIT 1');
  if (users.length === 0) {
    console.log('Seeding initial owner account...');
    const username = process.env.OWNER_USERNAME || 'owner';
    const rawPass = process.env.OWNER_PASSWORD || 'ownerpassword123';
    const passHash = await bcrypt.hash(rawPass, 10);
    
    await execute(
      'INSERT INTO owner (username, password_hash, name, email) VALUES (?, ?, ?, ?)',
      [username, passHash, 'Sivakozhundhu', 'sivakozhundhu@harvester.com']
    );
    console.log(`Owner account initialized for Sivakozhundhu!`);
  }
}

// Seed Official Fleet Vehicles from RC Certificates
async function seedVehicles() {
  const vehicles = [
    {
      id: 'TN32BF8500',
      name: 'Harvester - Case IH Austoft 4010 Maxx (TN 32 BF 8500)',
      model: 'CASE IH AUSTOFT 4010 MAXX',
      serial_number: 'PNEY4010LR2EB0435',
      purchase_date: '2024-07-05',
      status: 'Active'
    },
    {
      id: 'TN32BF8451',
      name: 'Infielder 1 - New Holland 3630 TX (TN 32 BF 8451)',
      model: 'NH 3630 TX A1',
      serial_number: 'NHN36300ZRC686589',
      purchase_date: '2024-07-05',
      status: 'Active'
    },
    {
      id: 'TN32BF8438',
      name: 'Infielder 2 - New Holland 3630 TX (TN 32 BF 8438)',
      model: 'NH 3630 TX A1',
      serial_number: 'NHN36300ZRC686593',
      purchase_date: '2024-07-05',
      status: 'Active'
    }
  ];

  // Remove any legacy dummy harvesters
  await execute("DELETE FROM harvesters WHERE id NOT IN ('TN32BF8500', 'TN32BF8451', 'TN32BF8438')");

  for (const v of vehicles) {
    const exists = await query('SELECT id FROM harvesters WHERE id = ?', [v.id]);
    if (exists.length === 0) {
      await execute(
        'INSERT INTO harvesters (id, name, model, serial_number, purchase_date, status) VALUES (?, ?, ?, ?, ?, ?)',
        [v.id, v.name, v.model, v.serial_number, v.purchase_date, v.status]
      );
    } else {
      await execute(
        'UPDATE harvesters SET name = ?, model = ?, serial_number = ?, purchase_date = ?, status = ? WHERE id = ?',
        [v.name, v.model, v.serial_number, v.purchase_date, v.status, v.id]
      );
    }
  }
}
