import sqlite3 from 'sqlite3';
import { promisify } from 'util';

const db = new sqlite3.Database('auth.db');

const dbRun = promisify(db.run.bind(db));
const dbGet = promisify(db.get.bind(db));
const dbAll = promisify(db.all.bind(db));

db.serialize(() => {
  db.run('PRAGMA foreign_keys = ON');
  db.run('PRAGMA journal_mode = WAL');

  // Drop existing tables
  db.run('DROP TABLE IF EXISTS projects');
  db.run('DROP TABLE IF EXISTS magic_links');
  db.run('DROP TABLE IF EXISTS users');

  // Create users table
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      verified BOOLEAN DEFAULT FALSE,
      github_id TEXT UNIQUE,
      github_username TEXT,
      github_access_token TEXT
    )
  `);

  // Create projects table
  db.run(`
    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      repository TEXT NOT NULL,
      content_directory TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  // Create magic links table
  db.run(`
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
  db.run('CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)');
  db.run('CREATE INDEX IF NOT EXISTS idx_users_github_id ON users(github_id)');
  db.run('CREATE INDEX IF NOT EXISTS idx_projects_user_id ON projects(user_id)');
  db.run('CREATE INDEX IF NOT EXISTS idx_magic_links_user_id ON magic_links(user_id)');

  // Create triggers for updated_at
  db.run(`
    CREATE TRIGGER IF NOT EXISTS update_users_timestamp 
    AFTER UPDATE ON users
    BEGIN
      UPDATE users SET updated_at = CURRENT_TIMESTAMP 
      WHERE id = NEW.id;
    END
  `);

  db.run(`
    CREATE TRIGGER IF NOT EXISTS update_projects_timestamp 
    AFTER UPDATE ON projects
    BEGIN
      UPDATE projects SET updated_at = CURRENT_TIMESTAMP 
      WHERE id = NEW.id;
    END
  `);
});

export { db, dbRun, dbGet, dbAll };
