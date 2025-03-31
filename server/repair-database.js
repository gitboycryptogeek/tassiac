// server/repair-database.js
const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcrypt');

const DB_PATH = path.join(__dirname, '..', 'database.sqlite');
const BACKUP_FOLDER = path.join(__dirname, '..', 'backups');

// Ensure backup folder exists
if (!fs.existsSync(BACKUP_FOLDER)) {
  fs.mkdirSync(BACKUP_FOLDER, { recursive: true });
}

// Create a database backup before making changes
function backupDatabase() {
  const timestamp = Date.now();
  const backupPath = path.join(BACKUP_FOLDER, `database.sqlite.backup-${timestamp}`);
  
  console.log(`Creating database backup at ${backupPath}`);
  
  try {
    // Copy the database file
    fs.copyFileSync(DB_PATH, backupPath);
    console.log('Backup created successfully');
    return true;
  } catch (error) {
    console.error('Error creating backup:', error);
    return false;
  }
}

// Open database connection
function openDatabase() {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(DB_PATH, (err) => {
      if (err) {
        console.error('Error opening database:', err);
        reject(err);
      } else {
        console.log('Connected to SQLite database');
        resolve(db);
      }
    });
  });
}

// Execute a query
function executeQuery(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) {
        console.error(`Error executing query: ${sql}`, err);
        reject(err);
      } else {
        resolve({ lastID: this.lastID, changes: this.changes });
      }
    });
  });
}

// Get all tables in the database
function getTables(db) {
  return new Promise((resolve, reject) => {
    db.all("SELECT name FROM sqlite_master WHERE type='table'", (err, tables) => {
      if (err) {
        console.error('Error getting tables:', err);
        reject(err);
      } else {
        resolve(tables.map(t => t.name));
      }
    });
  });
}

// Get table columns
function getTableColumns(db, tableName) {
  return new Promise((resolve, reject) => {
    db.all(`PRAGMA table_info(${tableName})`, (err, columns) => {
      if (err) {
        console.error(`Error getting columns for table ${tableName}:`, err);
        reject(err);
      } else {
        resolve(columns);
      }
    });
  });
}

// Check if a column exists in a table
async function columnExists(db, tableName, columnName) {
  try {
    const columns = await getTableColumns(db, tableName);
    return columns.some(column => column.name === columnName);
  } catch (error) {
    console.error(`Error checking if column ${columnName} exists in ${tableName}:`, error);
    return false;
  }
}

// Add a column to a table if it doesn't exist
async function addColumnIfNotExists(db, tableName, columnName, columnType) {
  try {
    const exists = await columnExists(db, tableName, columnName);
    if (!exists) {
      console.log(`Adding column ${columnName} to table ${tableName}`);
      await executeQuery(db, `ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${columnType}`);
      console.log(`Column ${columnName} added successfully to ${tableName}`);
    } else {
      console.log(`Column ${columnName} already exists in table ${tableName}`);
    }
  } catch (error) {
    console.error(`Error adding column ${columnName} to ${tableName}:`, error);
  }
}

// Create Users table if it doesn't exist
async function ensureUsersTable(db) {
  try {
    const tables = await getTables(db);
    
    if (!tables.includes('Users')) {
      console.log('Creating Users table');
      await executeQuery(db, `
        CREATE TABLE Users (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          username TEXT NOT NULL UNIQUE,
          password TEXT NOT NULL,
          fullName TEXT NOT NULL,
          email TEXT,
          phone TEXT NOT NULL,
          isAdmin INTEGER DEFAULT 0,
          lastLogin TEXT,
          resetToken TEXT,
          resetTokenExpiry TEXT,
          isActive INTEGER DEFAULT 1,
          createdAt TEXT NOT NULL,
          updatedAt TEXT NOT NULL
        )
      `);
      console.log('Users table created successfully');
    } else {
      console.log('Users table already exists');
      
      // Add any missing columns
      await addColumnIfNotExists(db, 'Users', 'resetToken', 'TEXT');
      await addColumnIfNotExists(db, 'Users', 'resetTokenExpiry', 'TEXT');
      await addColumnIfNotExists(db, 'Users', 'isActive', 'INTEGER DEFAULT 1');
    }
  } catch (error) {
    console.error('Error ensuring Users table:', error);
  }
}

// Ensure at least one admin user exists
async function ensureAdminUser(db) {
  try {
    // Check if any admin users exist
    const admins = await new Promise((resolve, reject) => {
      db.all('SELECT * FROM Users WHERE isAdmin = 1', (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });
    
    if (admins.length === 0) {
      console.log('No admin users found. Creating default admin user.');
      
      // Hash the password
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash('Admin123', salt);
      
      // Create default admin
      await executeQuery(db, 
        `INSERT INTO Users (username, password, fullName, email, phone, isAdmin, createdAt, updatedAt) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          'admin',
          hashedPassword,
          'System Administrator',
          'admin@tassiac.church',
          '1000000001',
          1,
          new Date().toISOString(),
          new Date().toISOString()
        ]
      );
      
      console.log('Default admin user created with username: admin and password: Admin123');
    } else {
      console.log(`Found ${admins.length} admin users in the database`);
    }
  } catch (error) {
    console.error('Error ensuring admin user:', error);
  }
}

// Main repair function
async function repairDatabase() {
  console.log('Starting database repair...');
  
  // Create backup first
  const backupSuccess = backupDatabase();
  if (!backupSuccess) {
    console.error('Failed to create database backup. Aborting repair.');
    process.exit(1);
  }
  
  let db;
  
  try {
    // Open database
    db = await openDatabase();
    
    // Ensure tables exist with correct structure
    await ensureUsersTable(db);
    
    // Ensure at least one admin user
    await ensureAdminUser(db);
    
    console.log('Database repair completed successfully');
  } catch (error) {
    console.error('Error during database repair:', error);
  } finally {
    // Close database connection
    if (db) {
      db.close((err) => {
        if (err) {
          console.error('Error closing database:', err);
        } else {
          console.log('Database connection closed');
        }
      });
    }
  }
}

// Run the repair script
repairDatabase().catch(error => {
  console.error('Unhandled error during database repair:', error);
  process.exit(1);
});