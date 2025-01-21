import { Router } from 'express';
import axios from 'axios';
import { dbGet, dbRun } from '../../db.js';
import { githubApi } from '../../utils/github.js';

const router = Router();

router.get('/connect', (req, res) => {
  if (!req.session.user) {
    return res.redirect('/auth/login');
  }
  
  const githubAuthUrl = `https://github.com/login/oauth/authorize?client_id=${
    process.env.GITHUB_CLIENT_ID
  }&scope=repo&state=${req.session.user.id}`;
  res.redirect(githubAuthUrl);
});

router.get('/callback', async (req, res) => {
  const { code, state } = req.query;

  if (!code || !state) {
    return res.redirect('/dashboard?error=invalid_github_callback');
  }

  try {
    const tokenResponse = await axios.post(
      'https://github.com/login/oauth/access_token',
      {
        client_id: process.env.GITHUB_CLIENT_ID,
        client_secret: process.env.GITHUB_CLIENT_SECRET,
        code,
      },
      {
        headers: {
          Accept: 'application/json',
        },
      }
    );

    const accessToken = tokenResponse.data.access_token;
    
    if (!accessToken) {
      throw new Error('Failed to obtain GitHub access token');
    }

    const userResponse = await githubApi.get('/user', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    const githubUser = userResponse.data;

    await dbRun(
      `UPDATE users 
       SET github_id = ?, github_username = ?, github_access_token = ? 
       WHERE id = ?`,
      [githubUser.id, githubUser.login, accessToken, state]
    );

    const user = await dbGet('SELECT * FROM users WHERE id = ?', [state]);
    req.session.user = user;

    res.redirect('/dashboard');
  } catch (error) {
    console.error('GitHub OAuth Error:', error);
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
           selected_repo = NULL,
           content_directory = NULL 
       WHERE id = ?`,
      [req.session.user.id]
    );

    const user = await dbGet('SELECT * FROM users WHERE id = ?', [req.session.user.id]);
    req.session.user = user;

    res.json({ success: true });
  } catch (error) {
    console.error('Error disconnecting GitHub:', error);
    res.status(500).json({ error: 'Failed to disconnect GitHub account' });
  }
});

export { router as default };
