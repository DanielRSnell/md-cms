import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { dbGet, dbRun, dbAll } from '../db.js';
import { sendMagicLink } from '../mail.js';

const router = Router();

// Error handler wrapper
const asyncHandler = (fn) => (req, res, next) => {
  return Promise.resolve(fn(req, res, next)).catch(next);
};

// Input validation middleware
const validateEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

const validatePassword = (password) => {
  return password.length >= 8;
};

// Rate limiting
const rateLimiter = new Map();
const RATE_LIMIT_WINDOW = 15 * 60 * 1000; // 15 minutes
const MAX_ATTEMPTS = 5;

const checkRateLimit = (ip) => {
  const now = Date.now();
  const attempts = rateLimiter.get(ip) || [];
  
  // Clean up old attempts
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
}, 60 * 1000); // Every minute

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

router.get('/signup', redirectIfAuthenticated, (req, res) => {
  res.render('auth/signup', { error: null });
});

router.post('/signup', redirectIfAuthenticated, asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  
  // Input validation
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
    // Check if email exists
    const existingUser = await dbGet('SELECT id FROM users WHERE email = ?', [email]);
    if (existingUser) {
      return res.render('auth/signup', { error: 'Email already registered' });
    }

    const id = uuidv4();
    const hashedPassword = await bcrypt.hash(password, 12);
    
    await dbRun(
      'INSERT INTO users (id, email, password) VALUES (?, ?, ?)', 
      [id, email.toLowerCase(), hashedPassword]
    );
    
    // Create session
    req.session.user = { id, email };
    req.session.save((err) => {
      if (err) {
        console.error('Session save error:', err);
      }
      res.redirect('/dashboard');
    });
  } catch (error) {
    console.error('Signup error:', error);
    res.render('auth/signup', { error: 'Error creating account' });
  }
}));

router.post('/login', redirectIfAuthenticated, asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  
  // Rate limiting
  if (!checkRateLimit(req.ip)) {
    return res.render('auth/login', { 
      error: 'Too many login attempts. Please try again later.' 
    });
  }

  // Input validation
  if (!email || !password) {
    return res.render('auth/login', { error: 'Email and password are required' });
  }

  if (!validateEmail(email)) {
    return res.render('auth/login', { error: 'Invalid email format' });
  }

  try {
    const user = await dbGet('SELECT * FROM users WHERE email = ?', [email.toLowerCase()]);
    
    if (!user) {
      return res.render('auth/login', { error: 'Invalid credentials' });
    }

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.render('auth/login', { error: 'Invalid credentials' });
    }

    // Clear rate limit on successful login
    rateLimiter.delete(req.ip);

    // Create session
    req.session.user = {
      id: user.id,
      email: user.email,
      github_id: user.github_id,
      github_username: user.github_username,
      selected_repo: user.selected_repo
    };

    req.session.save((err) => {
      if (err) {
        console.error('Session save error:', err);
      }
      res.redirect('/dashboard');
    });
  } catch (error) {
    console.error('Login error:', error);
    res.render('auth/login', { error: 'Error during login' });
  }
}));

router.post('/magic-link', redirectIfAuthenticated, asyncHandler(async (req, res) => {
  const { email } = req.body;
  
  if (!email || !validateEmail(email)) {
    return res.render('auth/login', { error: 'Valid email is required' });
  }

  // Rate limiting
  if (!checkRateLimit(req.ip)) {
    return res.render('auth/login', { 
      error: 'Too many requests. Please try again later.' 
    });
  }

  try {
    const user = await dbGet('SELECT id FROM users WHERE email = ?', [email.toLowerCase()]);
    
    if (user) {
      const token = uuidv4();
      const expires = new Date(Date.now() + 3600000); // 1 hour
      
      // Delete any existing unused magic links for this user
      await dbRun(
        'DELETE FROM magic_links WHERE user_id = ? AND used = FALSE',
        [user.id]
      );

      // Create new magic link
      await dbRun(
        'INSERT INTO magic_links (token, user_id, expires_at) VALUES (?, ?, ?)',
        [token, user.id, expires]
      );

      if (process.env.SMTP_HOST) {
        await sendMagicLink(email, token);
      } else {
        console.log('Magic link for development:', `${process.env.BASE_URL}/auth/verify/${token}`);
      }
    }

    // Always show success to prevent email enumeration
    res.render('auth/magic-link-sent');
  } catch (error) {
    console.error('Magic link error:', error);
    res.render('auth/login', { error: 'Error sending magic link' });
  }
}));

router.get('/verify/:token', asyncHandler(async (req, res) => {
  const { token } = req.params;
  
  try {
    const result = await dbGet(`
      SELECT ml.*, u.* 
      FROM magic_links ml 
      JOIN users u ON ml.user_id = u.id 
      WHERE ml.token = ? 
        AND ml.expires_at > datetime('now')
        AND ml.used = FALSE
    `, [token]);

    if (!result) {
      return res.redirect('/auth/login?error=invalid_or_expired_link');
    }

    // Mark magic link as used
    await dbRun(
      'UPDATE magic_links SET used = TRUE WHERE token = ?',
      [token]
    );

    // Create session
    req.session.user = {
      id: result.id,
      email: result.email,
      github_id: result.github_id,
      github_username: result.github_username,
      selected_repo: result.selected_repo
    };

    req.session.save((err) => {
      if (err) {
        console.error('Session save error:', err);
      }
      res.redirect('/dashboard');
    });
  } catch (error) {
    console.error('Verification error:', error);
    res.redirect('/auth/login?error=verification_failed');
  }
}));

router.get('/logout', asyncHandler(async (req, res) => {
  // Clear session from database
  if (req.session.id) {
    try {
      await dbRun('DELETE FROM sessions WHERE sid = ?', [req.session.id]);
    } catch (error) {
      console.error('Session deletion error:', error);
    }
  }

  // Destroy session
  req.session.destroy((err) => {
    if (err) {
      console.error('Session destruction error:', err);
    }
    
    // Clear session cookie
    res.clearCookie('sessionId');
    res.redirect('/');
  });
}));

// Password reset functionality (if needed)
router.get('/reset-password', redirectIfAuthenticated, (req, res) => {
  res.render('auth/reset-password', { error: null });
});

router.post('/reset-password', redirectIfAuthenticated, asyncHandler(async (req, res) => {
  const { email } = req.body;
  
  if (!email || !validateEmail(email)) {
    return res.render('auth/reset-password', { error: 'Valid email is required' });
  }

  // Rate limiting
  if (!checkRateLimit(req.ip)) {
    return res.render('auth/reset-password', { 
      error: 'Too many requests. Please try again later.' 
    });
  }

  try {
    const user = await dbGet('SELECT id FROM users WHERE email = ?', [email.toLowerCase()]);
    
    if (user) {
      const token = uuidv4();
      const expires = new Date(Date.now() + 3600000); // 1 hour
      
      // Implementation for password reset tokens would go here
      // For now, just show success message
      res.render('auth/reset-password-sent');
    } else {
      // Always show success to prevent email enumeration
      res.render('auth/reset-password-sent');
    }
  } catch (error) {
    console.error('Password reset error:', error);
    res.render('auth/reset-password', { error: 'Error processing request' });
  }
}));

// Error handler
router.use((error, req, res, next) => {
  console.error('Auth error:', error);
  res.status(500).render('error', {
    error: process.env.NODE_ENV === 'production'
      ? 'Authentication error occurred'
      : error.message
  });
});

export { router as authRouter };
