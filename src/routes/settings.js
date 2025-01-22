import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { UserModel } from '../db/models/user.js';

const router = Router();

router.get('/', requireAuth, async (req, res) => {
  try {
    const user = await UserModel.findById(req.session.user.id);
    res.render('settings', { 
      user,
      githubAccounts: user.github_id ? [{
        id: user.github_id,
        username: user.github_username,
        connected_at: new Date(),
        avatar_url: `https://avatars.githubusercontent.com/u/${user.github_id}?v=4`
      }] : []
    });
  } catch (error) {
    console.error('Error loading settings:', error);
    res.status(500).render('error', { error: 'Failed to load settings' });
  }
});

export { router as settingsRouter };
