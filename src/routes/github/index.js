import { Router } from 'express';
import authRoutes from './auth.js';
import repoRoutes from './repos.js';
import fileRoutes from './files.js';

const router = Router();

router.use('/', authRoutes);
router.use('/repos', repoRoutes);
router.use('/files', fileRoutes);

export { router as githubRouter };
