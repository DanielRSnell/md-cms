import { Router } from 'express';
import axios from 'axios';
import { dbGet, dbRun } from '../../db.js';
import repoRoutes from './repos.js';
import fileRoutes from './files.js';

const router = Router();

// GitHub OAuth routes
router.get('/connect', (req, res) => {
  if (!req.session?.user?.id) {
    console.error('No user session found');
    return res.redirect('/auth/login');
  }
  
  try {
    // Generate the GitHub OAuth URL
    const githubAuthUrl = new URL('https://github.com/login/oauth/authorize');
    githubAuthUrl.searchParams.append('client_id', process.env.GITHUB_CLIENT_ID);
    githubAuthUrl.searchParams.append('scope', 'repo');
    githubAuthUrl.searchParams.append('state', req.session.user.id);

    console.log('Redirecting to GitHub OAuth:', {
      clientId: process.env.GITHUB_CLIENT_ID,
      userId: req.session.user.id,
      url: githubAuthUrl.toString()
    });

    res.redirect(githubAuthUrl.toString());
  } catch (error) {
    console.error('Error initiating GitHub OAuth:', error);
    res.redirect('/dashboard?error=github_connect_failed');
  }
});

router.get('/callback', async (req, res) => {
  const { code, state } = req.query;

  if (!code || !state) {
    console.error('Missing code or state in callback');
    return res.redirect('/dashboard?error=invalid_github_callback');
  }

  try {
    console.log('Exchanging code for access token...');
    const tokenResponse = await axios.post('https://github.com/login/oauth/access_token', {
      client_id: process.env.GITHUB_CLIENT_ID,
      client_secret: process.env.GITHUB_CLIENT_SECRET,
      code,
    }, {
      headers: {
        Accept: 'application/json',
      },
    });

    console.log('Token response:', tokenResponse.data);
    const accessToken = tokenResponse.data.access_token;
    
    if (!accessToken) {
      throw new Error('Failed to obtain GitHub access token');
    }

    console.log('Getting GitHub user info...');
    const userResponse = await axios.get('https://api.github.com/user', {
      headers: {
        Authorization: `token ${accessToken}`,
      },
    });

    console.log('User response:', userResponse.data);
    const githubUser = userResponse.data;

    if (!githubUser || !githubUser.id) {
      throw new Error('Invalid GitHub user data received');
    }

    console.log('Updating user record...');
    await dbRun(
      `UPDATE users 
       SET github_id = ?, github_username = ?, github_access_token = ? 
       WHERE id = ?`,
      [githubUser.id.toString(), githubUser.login, accessToken, state]
    );

    console.log('Getting updated user data...');
    const user = await dbGet('SELECT * FROM users WHERE id = ?', [state]);
    
    if (!user) {
      throw new Error('User not found after update');
    }

    req.session.user = {
      id: user.id,
      email: user.email,
      github_id: user.github_id,
      github_username: user.github_username,
      github_access_token: user.github_access_token,
      selected_repo: user.selected_repo
    };

    console.log('GitHub OAuth successful, redirecting to dashboard...');
    res.redirect('/dashboard');
  } catch (error) {
    console.error('GitHub OAuth Error:', {
      message: error.message,
      response: error.response?.data,
      stack: error.stack
    });
    res.redirect('/dashboard?error=github_auth_failed&message=' + encodeURIComponent(error.message));
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

router.use('/repos', repoRoutes);
router.use('/files', fileRoutes);

export { router as githubRouter };
