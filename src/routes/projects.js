import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { dbGet, dbRun, dbAll } from '../db.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

// Get all projects for user
router.get('/', requireAuth, async (req, res) => {
  try {
    const projects = await dbAll(
      'SELECT * FROM projects WHERE user_id = ? ORDER BY updated_at DESC',
      [req.session.user.id]
    );
    res.json(projects);
  } catch (error) {
    console.error('Error fetching projects:', error);
    res.status(500).json({ error: 'Failed to fetch projects' });
  }
});

// Create new project
router.post('/', requireAuth, async (req, res) => {
  const { name, description, repository, contentDirectory } = req.body;

  if (!name || !repository || !contentDirectory) {
    return res.status(400).json({ error: 'Name, repository, and content directory are required' });
  }

  try {
    const projectId = uuidv4();
    await dbRun(
      `INSERT INTO projects (id, user_id, name, description, repository, content_directory) 
       VALUES (?, ?, ?, ?, ?, ?)`,
      [projectId, req.session.user.id, name, description, repository, contentDirectory]
    );

    const project = await dbGet('SELECT * FROM projects WHERE id = ?', [projectId]);
    res.json(project);
  } catch (error) {
    console.error('Error creating project:', error);
    res.status(500).json({ error: 'Failed to create project' });
  }
});

// Get single project
router.get('/:id', requireAuth, async (req, res) => {
  try {
    const project = await dbGet(
      'SELECT * FROM projects WHERE id = ? AND user_id = ?',
      [req.params.id, req.session.user.id]
    );

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    res.json(project);
  } catch (error) {
    console.error('Error fetching project:', error);
    res.status(500).json({ error: 'Failed to fetch project' });
  }
});

// Update project
router.put('/:id', requireAuth, async (req, res) => {
  const { name, description } = req.body;

  if (!name) {
    return res.status(400).json({ error: 'Name is required' });
  }

  try {
    const project = await dbGet(
      'SELECT * FROM projects WHERE id = ? AND user_id = ?',
      [req.params.id, req.session.user.id]
    );

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    await dbRun(
      'UPDATE projects SET name = ?, description = ? WHERE id = ?',
      [name, description, req.params.id]
    );

    const updatedProject = await dbGet('SELECT * FROM projects WHERE id = ?', [req.params.id]);
    res.json(updatedProject);
  } catch (error) {
    console.error('Error updating project:', error);
    res.status(500).json({ error: 'Failed to update project' });
  }
});

// Delete project
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const project = await dbGet(
      'SELECT * FROM projects WHERE id = ? AND user_id = ?',
      [req.params.id, req.session.user.id]
    );

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    await dbRun('DELETE FROM projects WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting project:', error);
    res.status(500).json({ error: 'Failed to delete project' });
  }
});

export { router as projectsRouter };
