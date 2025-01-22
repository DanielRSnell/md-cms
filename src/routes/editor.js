import { Router } from 'express';
import { requireAuth, requireGitHub } from '../middleware/auth.js';
import { ProjectModel } from '../db/models/project.js';

const router = Router();

router.get('/:projectId', requireAuth, requireGitHub, async (req, res) => {
  try {
    const project = await ProjectModel.findById(req.params.projectId);
    
    if (!project) {
      return res.status(404).render('error', { error: 'Project not found' });
    }

    if (project.user_id !== req.session.user.id) {
      return res.status(403).render('error', { error: 'Not authorized to access this project' });
    }

    res.render('editor/index', { project });
  } catch (error) {
    console.error('Error loading editor:', error);
    res.status(500).render('error', { error: 'Failed to load editor' });
  }
});

export { router as editorRouter };
