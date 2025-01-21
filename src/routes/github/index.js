import { Router } from 'express';
import axios from 'axios';
import { dbGet, dbRun } from '../db.js';
import repoRoutes from './repos.js';
import fileRoutes from './files.js';

const router = Router();

// GitHub OAuth routes
router.get('/connect', (req, res) => {
  if (!req.session.user) {
    return res.redirect('/auth/login');
  }
  
  // Generate the GitHub OAuth URL
  const githubAuthUrl = new URL('https://github.com/login/oauth/authorize');
  githubAuthUrl.searchParams.append('client_id', process.env.GITHUB_CLIENT_ID);
  githubAuthUrl.searchParams.append('scope', 'repo');
  githubAuthUrl.searchParams.append('state', req.session.user.id);

  console.log('Redirecting to GitHub:', githubAuthUrl.toString());
  res.redirect(githubAuthUrl.toString());
});

router.get('/callback', async (req, res) => {
  const { code, state } = req.query;

  if (!code || !state) {
    console.error('Missing code or state in callback');
    return res.redirect('/dashboard?error=invalid_github_callback');
  }

  try {
    // Exchange code for access token
    const tokenResponse = await axios.post('https://github.com/login/oauth/access_token', {
      client_id: process.env.GITHUB_CLIENT_ID,
      client_secret: process.env.GITHUB_CLIENT_SECRET,
      code,
    }, {
      headers: {
        Accept: 'application/json',
      },
    });

    const accessToken = tokenResponse.data.access_token;
    
    if (!accessToken) {
      throw new Error('Failed to obtain GitHub access token');
    }

    // Get GitHub user info
    const userResponse = await axios.get('https://api.github.com/user', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    const githubUser = userResponse.data;

    // Update user record with GitHub info
    await dbRun(
      `UPDATE users 
       SET github_id = ?, github_username = ?, github_access_token = ? 
       WHERE id = ?`,
      [githubUser.id, githubUser.login, accessToken, state]
    );

    // Update session
    const user = await dbGet('SELECT * FROM users WHERE id = ?', [state]);
    req.session.user = {
      id: user.id,
      email: user.email,
      github_id: user.github_id,
      github_username: user.github_username,
      github_access_token: user.github_access_token,
      selected_repo: user.selected_repo
    };

    res.redirect('/dashboard');
  } catch (error) {
    console.error('GitHub OAuth Error:', error.response?.data || error.message);
    res.redirect('/dashboard?error=github_auth_failed');
  }
});

router.post('/disconnect', async (req, res) => {
  if (!req.session.user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    await dbRun(
      `UPDATE users 
       SET github_id = NULL, 
           github_username = NULL, 
           github_access_token = NULL, 
           selected_repo = NULL
       WHERE id = ?`,
      [req.session.user.id]
    );

    const user = await dbGet('SELECT * FROM users WHERE id = ?', [req.session.user.id]);
    req.session.user = {
      id: user.id,
      email: user.email
    };

    res.json({ success: true });
  } catch (error) {
    console.error('Error disconnecting GitHub:', error);
    res.status(500).json({ error: 'Failed to disconnect GitHub account' });
  }
});

// Mount other routes
router.use('/repos', repoRoutes);
router.use('/files', fileRoutes);

export { router as githubRouter };
