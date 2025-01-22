import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { UserModel } from '../db/models/user.js';
import { sendMagicLink } from '../mail.js';

const router = Router();

// Error handler wrapper
const asyncHandler = (fn) => (req, res, next) => {
  return Promise.resolve(fn(req, res, next)).catch(next);
};

// Input validation
const validateEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

const validatePassword = (password) => {
  return password.length >= 8;
};

// Rate limiting setup
const rateLimiter = new Map();
const RATE_LIMIT_WINDOW = 15 * 60 * 1000; // 15 minutes
const MAX_ATTEMPTS = 5;

const checkRateLimit = (ip) => {
  const now = Date.now();
  const attempts = rateLimiter.get(ip) || [];
  const recentAttempts = attempts.filter(timestamp => now - timestamp < RATE_LIMIT_WINDOW);
  
  if (recentAttempts.length >= MAX_ATTEMPTS) {
    return false;
  }
  
  recentAttempts.push(now);
  rateLimiter.set(ip, recentAttempts);
  return true;
};

// Clean up rate limiter periodically
setInterval(() => {
  const now = Date.now();
  for (const [ip, attempts] of rateLimiter.entries()) {
    const recentAttempts = attempts.filter(timestamp => now - timestamp < RATE_LIMIT_WINDOW);
    if (recentAttempts.length === 0) {
      rateLimiter.delete(ip);
    } else {
      rateLimiter.set(ip, recentAttempts);
    }
  }
}, 60 * 1000);

// Middleware to redirect authenticated users
const redirectIfAuthenticated = (req, res, next) => {
  if (req.session.user) {
    return res.redirect('/dashboard');
  }
  next();
};

// Auth routes
router.get('/login', redirectIfAuthenticated, (req, res) => {
  res.render('auth/login', { error: null });
});

router.post('/login', redirectIfAuthenticated, asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  
  if (!checkRateLimit(req.ip)) {
    return res.render('auth/login', { 
      error: 'Too many login attempts. Please try again later.' 
    });
  }

  if (!email || !password) {
    return res.render('auth/login', { error: 'Email and password are required' });
  }

  try {
    const user = await UserModel.findByEmail(email.toLowerCase());
    
    if (!user || !await bcrypt.compare(password, user.password)) {
      return res.render('auth/login', { error: 'Invalid credentials' });
    }

    rateLimiter.delete(req.ip);

    req.session.user = {
      id: user.id,
      email: user.email,
      github_id: user.github_id,
      github_username: user.github_username,
      github_access_token: user.github_access_token
    };

    req.session.save((err) => {
      if (err) console.error('Session save error:', err);
      res.redirect('/dashboard');
    });
  } catch (error) {
    console.error('Login error:', error);
    res.render('auth/login', { error: 'Error during login' });
  }
}));

router.get('/signup', redirectIfAuthenticated, (req, res) => {
  res.render('auth/signup', { error: null });
});

router.post('/signup', redirectIfAuthenticated, asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  
  if (!email || !password) {
    return res.render('auth/signup', { error: 'Email and password are required' });
  }

  if (!validateEmail(email)) {
    return res.render('auth/signup', { error: 'Invalid email format' });
  }

  if (!validatePassword(password)) {
    return res.render('auth/signup', { 
      error: 'Password must be at least 8 characters long'
    });
  }

  try {
    const existingUser = await UserModel.findByEmail(email);
    if (existingUser) {
      return res.render('auth/signup', { error: 'Email already registered' });
    }

    const hashedPassword = await bcrypt.hash(password, 12);
    const user = await UserModel.create({
      id: uuidv4(),
      email: email.toLowerCase(),
      password: hashedPassword
    });
    
    req.session.user = {
      id: user.id,
      email: user.email
    };

    req.session.save((err) => {
      if (err) console.error('Session save error:', err);
      res.redirect('/dashboard');
    });
  } catch (error) {
    console.error('Signup error:', error);
    res.render('auth/signup', { error: 'Error creating account' });
  }
}));

router.get('/logout', asyncHandler(async (req, res) => {
  req.session.destroy((err) => {
    if (err) console.error('Session destruction error:', err);
    res.clearCookie('sessionId');
    res.redirect('/');
  });
}));

export { router as authRouter };
