// Table creation queries
const TABLES = {
  USERS: `
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
  `,

  PROJECTS: `
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
  `,

  MAGIC_LINKS: `
    CREATE TABLE IF NOT EXISTS magic_links (
      token TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      expires_at DATETIME NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      used BOOLEAN DEFAULT FALSE,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `
};

// Index creation queries
const INDEXES = {
  USERS_EMAIL: 'CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)',
  USERS_GITHUB_ID: 'CREATE INDEX IF NOT EXISTS idx_users_github_id ON users(github_id)',
  PROJECTS_USER_ID: 'CREATE INDEX IF NOT EXISTS idx_projects_user_id ON projects(user_id)',
  MAGIC_LINKS_USER_ID: 'CREATE INDEX IF NOT EXISTS idx_magic_links_user_id ON magic_links(user_id)'
};

// Trigger creation queries
const TRIGGERS = {
  UPDATE_USERS_TIMESTAMP: `
    CREATE TRIGGER IF NOT EXISTS update_users_timestamp 
    AFTER UPDATE ON users
    BEGIN
      UPDATE users SET updated_at = CURRENT_TIMESTAMP 
      WHERE id = NEW.id;
    END
  `,

  UPDATE_PROJECTS_TIMESTAMP: `
    CREATE TRIGGER IF NOT EXISTS update_projects_timestamp 
    AFTER UPDATE ON projects
    BEGIN
      UPDATE projects SET updated_at = CURRENT_TIMESTAMP 
      WHERE id = NEW.id;
    END
  `
};

export const createTables = async (db) => {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      try {
        // Create tables
        Object.values(TABLES).forEach(query => {
          db.run(query);
        });

        // Create indexes
        Object.values(INDEXES).forEach(query => {
          db.run(query);
        });

        // Create triggers
        Object.values(TRIGGERS).forEach(query => {
          db.run(query);
        });

        resolve();
      } catch (error) {
        reject(error);
      }
    });
  });
};
