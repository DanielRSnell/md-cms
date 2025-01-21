import { db } from '../db.js';

export const resetDatabase = async () => {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      // Drop existing tables
      db.run('DROP TABLE IF EXISTS magic_links');
      db.run('DROP TABLE IF EXISTS users');

      // Recreate tables
      db.run(`
        CREATE TABLE users (
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
      `, (err) => {
        if (err) reject(err);
      });

      db.run(`
        CREATE TABLE magic_links (
          token TEXT PRIMARY KEY,
          user_id TEXT NOT NULL,
          expires_at DATETIME NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          used BOOLEAN DEFAULT FALSE,
          FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
        )
      `, (err) => {
        if (err) reject(err);
      });

      // Create indexes
      db.run('CREATE INDEX idx_users_email ON users(email)');
      db.run('CREATE INDEX idx_users_github_id ON users(github_id)');
      db.run('CREATE INDEX idx_magic_links_user_id ON magic_links(user_id)');

      // Create trigger
      db.run(`
        CREATE TRIGGER update_users_timestamp 
        AFTER UPDATE ON users
        BEGIN
          UPDATE users SET updated_at = CURRENT_TIMESTAMP 
          WHERE id = NEW.id;
        END
      `, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  });
};
