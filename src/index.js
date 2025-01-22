import 'dotenv/config';
import express from 'express';
import session from 'express-session';
import SQLiteStore from 'connect-sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import nunjucks from 'nunjucks';
import { authRouter } from './routes/auth.js';
import { githubRouter } from './routes/github/index.js';
import { projectsRouter } from './routes/projects.js';
import { db } from './db.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const SQLiteStoreSession = SQLiteStore(session);

// Nunjucks setup
const env = nunjucks.configure('src/views', {
  autoescape: true,
  express: app
});

// Add custom filter for current year
env.addFilter('currentYear', () => new Date().getFullYear());

app.set('view engine', 'njk');

// Middleware
app.use(express.static(join(__dirname, 'public')));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Session configuration
app.use(session({
  store: new SQLiteStoreSession({ 
    db: 'sessions.db',
    concurrentDB: true
  }),
  secret: process.env.SESSION_SECRET || 'your-secret-key',
  resave: false,
  saveUninitialized: false,
  cookie: { 
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 1000 * 60 * 60 * 24 * 7 // 1 week
  },
  name: 'sessionId'
}));

// Make user available to all templates
app.use((req, res, next) => {
  res.locals.user = req.session.user;
  next();
});

// Routes
app.get('/', (req, res) => {
  if (req.session.user) {
    return res.redirect('/dashboard');
  }
  res.render('index.njk');
});

// Auth middleware
const requireAuth = (req, res, next) => {
  if (!req.session.user) {
    return res.redirect('/auth/login');
  }
  next();
};

app.get('/dashboard', requireAuth, (req, res) => {
  res.render('dashboard.njk');
});

// Route handlers
app.use('/auth', authRouter);
app.use('/github', githubRouter);
app.use('/projects', projectsRouter);

// 404 handler
app.use((req, res) => {
  console.log('404 Not Found:', req.method, req.url);
  res.status(404).render('404.njk');
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).render('error.njk', { 
    error: process.env.NODE_ENV === 'production' 
      ? 'Something went wrong!' 
      : err.message,
    title: 'Error'
  });
});

// Start server
const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received. Shutting down gracefully...');
  db.close(() => {
    console.log('Database connection closed.');
    process.exit(0);
  });
});
