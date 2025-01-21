import 'dotenv/config';
import express from 'express';
import session from 'express-session';
import SQLiteStore from 'connect-sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { authRouter } from './routes/auth.js';
import { githubRouter } from './routes/github/index.js';
import { db } from './db.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const SQLiteStoreSession = SQLiteStore(session);

app.set('view engine', 'ejs');
app.set('views', join(__dirname, 'views'));
app.use(express.static(join(__dirname, 'public')));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.use(session({
  store: new SQLiteStoreSession({ 
    db: 'sessions.db',
    concurrentDB: true
  }),
  secret: process.env.GITHUB_CLIENT_SECRET,
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

app.use((req, res, next) => {
  res.locals.user = req.session.user;
  next();
});

app.get('/', (req, res) => {
  if (req.session.user) {
    return res.redirect('/dashboard');
  }
  res.render('index');
});

const requireAuth = (req, res, next) => {
  if (!req.session.user) {
    return res.redirect('/auth/login');
  }
  next();
};

app.get('/dashboard', requireAuth, (req, res) => {
  res.render('dashboard');
});

app.use('/auth', authRouter);
app.use('/github', githubRouter);

app.use((req, res) => {
  res.status(404).render('error', { 
    error: 'Page not found',
    title: '404 Not Found'
  });
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).render('error', { 
    error: process.env.NODE_ENV === 'production' 
      ? 'Something went wrong!' 
      : err.message,
    title: 'Error'
  });
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});

process.on('SIGTERM', () => {
  console.log('SIGTERM received. Shutting down gracefully...');
  db.close(() => {
    console.log('Database connection closed.');
    process.exit(0);
  });
});
