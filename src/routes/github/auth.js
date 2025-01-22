import { Router } from 'express';
import { dbGet, dbRun } from '../../db.js';
import { requireAuth } from '../../middleware/auth.js';
import { githubApi } from '../../config/github.js';
import crypto from 'crypto';

const router = Router();

// Store state tokens temporarily
const stateStore = new Map();

// Clean up expired states periodically
setInterval(() => {
  const now = Date.now();
  for (const [state, data] of stateStore.entries()) {
    if (now - data.timestamp > 1000 * 60 * 10) { // 10 minutes
      stateStore.delete(state);
    }
  }
}, 1000 * 60); // Clean every minute

router.get('/connect', requireAuth, async (req, res) => {
  try {
    // Check if user already has a GitHub account connected
    const user = await dbGet('SELECT github_id FROM users WHERE id = ?', [req.session.user.id]);
    if (user && user.github_id) {
      return res.redirect('/dashboard?error=github_already_connected');
    }

    // Generate state token
    const state = crypto.randomBytes(32).toString('hex');
    stateStore.set(state, {
      userId: req.session.user.id,
      timestamp: Date.now()
    });

    const params = new URLSearchParams({
      client_id: process.env.GITHUB_CLIENT_ID,
      redirect_uri: `${process.env.BASE_URL}/github/auth/callback`,
      scope: 'repo read:user user:email',
      state: state
    });

    res.redirect(`https://github.com/login/oauth/authorize?${params.toString()}`);
  } catch (error) {
    console.error('Error in GitHub connect:', error);
    res.redirect('/dashboard?error=github_connect_failed');
  }
});

router.get('/callback', async (req, res) => {
  const { code, state } = req.query;

  if (!code || !state) {
    return res.redirect('/dashboard?error=github_auth_failed');
  }

  try {
    // Validate state token
    const stateData = stateStore.get(state);
    if (!stateData) {
      return res.redirect('/dashboard?error=github_auth_expired');
    }
    stateStore.delete(state);

    // Exchange code for access token
    const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        client_id: process.env.GITHUB_CLIENT_ID,
        client_secret: process.env.GITHUB_CLIENT_SECRET,
        code,
        redirect_uri: `${process.env.BASE_URL}/github/auth/callback`
      })
    });

    const tokenData = await tokenResponse.json();
    if (!tokenData.access_token) {
      throw new Error('Failed to get access token');
    }

    // Get GitHub user info
    const userResponse = await githubApi.get('/user', {
      headers: {
        'Authorization': `Bearer ${tokenData.access_token}`,
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'Markdown-CMS'
      }
    });

    const githubUser = userResponse.data;

    // Check if GitHub account is already connected to another user
    const existingUser = await dbGet('SELECT id FROM users WHERE github_id = ?', [githubUser.id.toString()]);
    if (existingUser && existingUser.id !== stateData.userId) {
      return res.redirect('/dashboard?error=github_account_already_connected');
    }

    // Update user record
    await dbRun(
      `UPDATE users 
       SET github_id = ?, 
           github_username = ?, 
           github_access_token = ?,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [githubUser.id.toString(), githubUser.login, tokenData.access_token, stateData.userId]
    );

    // Get updated user data
    const updatedUser = await dbGet('SELECT * FROM users WHERE id = ?', [stateData.userId]);
    
    // Update session
    req.session.user = {
      id: updatedUser.id,
      email: updatedUser.email,
      github_id: updatedUser.github_id,
      github_username: updatedUser.github_username,
      github_access_token: updatedUser.github_access_token
    };

    await new Promise((resolve, reject) => {
      req.session.save((err) => {
        if (err) reject(err);
        else resolve();
      });
    });

    res.redirect('/dashboard');
  } catch (error) {
    console.error('GitHub auth error:', error);
    res.redirect('/dashboard?error=github_auth_failed&message=' + encodeURIComponent(error.message));
  }
});

router.post('/disconnect', requireAuth, async (req, res) => {
  try {
    // Check if user has any projects
    const projects = await dbGet(
      'SELECT COUNT(*) as count FROM projects WHERE user_id = ?', 
      [req.session.user.id]
    );

    if (projects.count > 0) {
      return res.status(400).json({ 
        error: 'Cannot disconnect GitHub account while projects exist. Please delete all projects first.' 
      });
    }

    // Disconnect GitHub
    await dbRun(
      `UPDATE users 
       SET github_id = NULL, 
           github_username = NULL, 
           github_access_token = NULL, 
           selected_repo = NULL,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [req.session.user.id]
    );

    // Update session
    req.session.user = {
      id: req.session.user.id,
      email: req.session.user.email
    };

    await new Promise((resolve, reject) => {
      req.session.save((err) => {
        if (err) reject(err);
        else resolve();
      });
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Error disconnecting GitHub:', error);
    res.status(500).json({ error: 'Failed to disconnect GitHub account' });
  }
});

export { router as authRouter };
