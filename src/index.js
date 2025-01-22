import 'dotenv/config';
import express from 'express';
import session from 'express-session';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import nunjucks from 'nunjucks';
import { authRouter } from './routes/auth.js';
import { githubRouter } from './routes/github/index.js';
import { projectsRouter } from './routes/projects.js';
import { createSessionConfig, validateSessionConfig } from './config/session.js';
import { db } from './db/index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();

// Nunjucks setup
const env = nunjucks.configure('src/views', {
  autoescape: true,
  express: app,
  noCache: process.env.NODE_ENV !== 'production'
});

// Add custom filter for current year
env.addFilter('currentYear', () => new Date().getFullYear());

app.set('view engine', 'njk');

// Middleware
app.use(express.static(join(__dirname, 'public')));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Session configuration
validateSessionConfig();
app.use(session(createSessionConfig(process.env.NODE_ENV === 'production')));

// Make user available to all templates
app.use((req, res, next) => {
  res.locals.user = req.session.user;
  next();
});

// Routes
app.get('/', async (req, res) => {
  if (req.session.user) {
    const projects = await db.all(
      'SELECT * FROM projects WHERE user_id = ? ORDER BY updated_at DESC',
      [req.session.user.id]
    );
    return res.render('dashboard', { projects });
  }
  res.render('index');
});

app.get('/dashboard', async (req, res) => {
  if (!req.session.user) {
    return res.redirect('/auth/login');
  }
  const projects = await db.all(
    'SELECT * FROM projects WHERE user_id = ? ORDER BY updated_at DESC',
    [req.session.user.id]
  );
  res.render('dashboard', { projects });
});

// Route handlers
app.use('/auth', authRouter);
app.use('/github', githubRouter);
app.use('/projects', projectsRouter);

// 404 handler
app.use((req, res) => {
  console.log('404 Not Found:', req.method, req.url);
  res.status(404).render('404');
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).render('error', { 
    error: process.env.NODE_ENV === 'production' 
      ? 'Something went wrong!' 
      : err.message
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
