import { Router } from 'express';
import { authRouter } from './auth.js';
import { reposRouter } from './repos.js';
import { filesRouter } from './files.js';

const router = Router();

router.use('/auth', authRouter);
router.use('/repos', reposRouter);
router.use('/files', filesRouter);

export { router as githubRouter };
