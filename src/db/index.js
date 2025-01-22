import sqlite3 from 'sqlite3';
import { promisify } from 'util';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, '../../data');
const DB_PATH = join(DATA_DIR, 'auth.db');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Enable verbose mode for better debugging
const sqlite = sqlite3.verbose();

// Create database connection
const db = new sqlite.Database(DB_PATH);

// Promisify database methods with better error handling
const dbRun = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) {
        console.error('Database error in dbRun:', err);
        reject(err);
      } else {
        resolve(this);
      }
    });
  });
};

const dbGet = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) {
        console.error('Database error in dbGet:', err);
        reject(err);
      } else {
        resolve(row);
      }
    });
  });
};

const dbAll = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) {
        console.error('Database error in dbAll:', err);
        reject(err);
      } else {
        resolve(rows);
      }
    });
  });
};

// Initialize database
const initializeDatabase = async () => {
  try {
    // Enable foreign keys and WAL mode
    await dbRun('PRAGMA foreign_keys = ON');
    await dbRun('PRAGMA journal_mode = WAL');

    // Create users table
    await dbRun(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        password TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        verified BOOLEAN DEFAULT FALSE,
        github_id TEXT UNIQUE,
        github_username TEXT,
        github_access_token TEXT,
        selected_repo TEXT
      )
    `);

    // Create projects table
    await dbRun(`
      CREATE TABLE IF NOT EXISTS projects (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        name TEXT NOT NULL,
        description TEXT,
        repository TEXT NOT NULL,
        content_directory TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    // Create magic_links table
    await dbRun(`
      CREATE TABLE IF NOT EXISTS magic_links (
        token TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        expires_at DATETIME NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        used BOOLEAN DEFAULT FALSE,
        FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    // Create indexes
    await dbRun('CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)');
    await dbRun('CREATE INDEX IF NOT EXISTS idx_users_github_id ON users(github_id)');
    await dbRun('CREATE INDEX IF NOT EXISTS idx_projects_user_id ON projects(user_id)');
    await dbRun('CREATE INDEX IF NOT EXISTS idx_magic_links_user_id ON magic_links(user_id)');

    // Create triggers for updated_at
    await dbRun(`
      CREATE TRIGGER IF NOT EXISTS update_users_timestamp 
      AFTER UPDATE ON users
      BEGIN
        UPDATE users SET updated_at = CURRENT_TIMESTAMP 
        WHERE id = NEW.id;
      END
    `);

    await dbRun(`
      CREATE TRIGGER IF NOT EXISTS update_projects_timestamp 
      AFTER UPDATE ON projects
      BEGIN
        UPDATE projects SET updated_at = CURRENT_TIMESTAMP 
        WHERE id = NEW.id;
      END
    `);

    console.log('Database initialized successfully');
  } catch (error) {
    console.error('Database initialization failed:', error);
    throw error;
  }
};

// Initialize database on startup
initializeDatabase().catch(error => {
  console.error('Failed to initialize database:', error);
  process.exit(1);
});

export { db, dbRun, dbGet, dbAll };
