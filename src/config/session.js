import session from 'express-session';
import SQLiteStore from 'connect-sqlite3';

const SQLiteStoreSession = SQLiteStore(session);

export const createSessionConfig = (isProd) => ({
  store: new SQLiteStoreSession({ 
    db: 'sessions.db',
    concurrentDB: true
  }),
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: { 
    secure: isProd,
    httpOnly: true,
    sameSite: 'strict',
    maxAge: 1000 * 60 * 60 * 24 * 7 // 1 week
  },
  name: 'sessionId'
});

export const validateSessionConfig = () => {
  if (!process.env.SESSION_SECRET) {
    throw new Error('SESSION_SECRET environment variable is required');
  }
  
  if (process.env.SESSION_SECRET.length < 32) {
    throw new Error('SESSION_SECRET should be at least 32 characters long');
  }
};
