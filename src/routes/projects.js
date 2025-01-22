import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { ProjectModel } from '../db/models/project.js';
import { requireAuth, requireGitHub } from '../middleware/auth.js';

const router = Router();

// Get all projects for user
router.get('/', requireAuth, async (req, res) => {
  try {
    const projects = await ProjectModel.findByUser(req.session.user.id);
    res.json(projects);
  } catch (error) {
    console.error('Error fetching projects:', error);
    res.status(500).json({ error: 'Failed to fetch projects' });
  }
});

// New project form
router.get('/new', requireAuth, requireGitHub, async (req, res) => {
  res.render('projects/new');
});

// Create new project
router.post('/', requireAuth, requireGitHub, async (req, res) => {
  const { name, description, repository } = req.body;

  if (!name || !repository) {
    return res.render('projects/new', { 
      error: 'Name and repository are required',
      values: { name, description, repository }
    });
  }

  try {
    const projectId = uuidv4();
    const project = await ProjectModel.create({
      id: projectId,
      user_id: req.session.user.id,
      name,
      description,
      repository
    });

    res.redirect(`/projects/${projectId}/select-directory`);
  } catch (error) {
    console.error('Error creating project:', error);
    res.render('projects/new', {
      error: 'Failed to create project. Please try again.',
      values: { name, description, repository }
    });
  }
});

// Directory selection routes
router.get('/:id/select-directory', requireAuth, requireGitHub, async (req, res) => {
  try {
    const project = await ProjectModel.findById(req.params.id);

    if (!project || project.user_id !== req.session.user.id) {
      return res.redirect('/dashboard');
    }

    res.render('projects/select-directory', { project });
  } catch (error) {
    console.error('Error loading directory selector:', error);
    res.status(500).render('error', { error: 'Failed to load directory selector' });
  }
});

router.post('/:id/directory', requireAuth, requireGitHub, async (req, res) => {
  const { contentDirectory } = req.body;

  if (!contentDirectory) {
    return res.status(400).json({ error: 'Content directory is required' });
  }

  try {
    const project = await ProjectModel.findById(req.params.id);

    if (!project || project.user_id !== req.session.user.id) {
      return res.status(404).json({ error: 'Project not found' });
    }

    await ProjectModel.updateContentDirectory(req.params.id, contentDirectory);
    res.redirect(`/editor/${req.params.id}`);
  } catch (error) {
    console.error('Error setting content directory:', error);
    res.status(500).json({ error: 'Failed to set content directory' });
  }
});

// Get single project
router.get('/:id', requireAuth, async (req, res) => {
  try {
    const project = await ProjectModel.findById(req.params.id);

    if (!project || project.user_id !== req.session.user.id) {
      return res.status(404).json({ error: 'Project not found' });
    }

    res.json(project);
  } catch (error) {
    console.error('Error fetching project:', error);
    res.status(500).json({ error: 'Failed to fetch project' });
  }
});

// Delete project
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const project = await ProjectModel.findById(req.params.id);

    if (!project || project.user_id !== req.session.user.id) {
      return res.status(404).json({ error: 'Project not found' });
    }

    await ProjectModel.delete(req.params.id);
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting project:', error);
    res.status(500).json({ error: 'Failed to delete project' });
  }
});

export { router as projectsRouter };
