import { Router } from 'express';
import { authRouter } from './auth.js';
import { githubRouter } from './github/index.js';
import { projectsRouter } from './projects.js';
import { settingsRouter } from './settings.js';
import { editorRouter } from './editor.js';
import { dashboardController } from '../controllers/dashboard.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

// Home page
router.get('/', async (req, res) => {
  if (req.session.user) {
    return dashboardController.show(req, res);
  }
  res.render('index');
});

// Dashboard
router.get('/dashboard', requireAuth, dashboardController.show);

// Mount other routers
router.use('/auth', authRouter);
router.use('/github', githubRouter);
router.use('/projects', projectsRouter);
router.use('/settings', settingsRouter);
router.use('/editor', editorRouter);

export { router };
