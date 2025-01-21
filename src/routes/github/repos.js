import { Router } from 'express';
import { dbGet, dbRun } from '../../db.js';
import { requireAuth, requireGitHub } from '../../middleware/auth.js';
import { githubApi } from '../../utils/github.js';

const router = Router();

router.get('/list', requireAuth, requireGitHub, async (req, res) => {
  try {
    const response = await githubApi.get('/user/repos', {
      headers: {
        Authorization: `Bearer ${req.githubToken}`,
      },
      params: {
        sort: 'updated',
        per_page: 100,
        visibility: 'all',
        affiliation: 'owner,collaborator,organization_member',
      },
    });

    const repos = response.data.map(repo => ({
      id: repo.id,
      name: repo.name,
      full_name: repo.full_name,
      default_branch: repo.default_branch,
      private: repo.private,
    }));

    res.json(repos);
  } catch (error) {
    console.error('Error fetching repos:', error);
    res.status(500).json({ error: 'Failed to fetch repositories' });
  }
});

router.post('/select', requireAuth, requireGitHub, async (req, res) => {
  const { repo } = req.body;
  
  if (!repo) {
    return res.status(400).json({ error: 'Repository name is required' });
  }

  try {
    await githubApi.get(`/repos/${repo}`, {
      headers: {
        Authorization: `Bearer ${req.githubToken}`,
      },
    });

    await dbRun(
      'UPDATE users SET selected_repo = ?, content_directory = NULL WHERE id = ?',
      [repo, req.session.user.id]
    );
    
    req.session.user = {
      ...req.session.user,
      selected_repo: repo,
      content_directory: null
    };

    res.json({ success: true });
  } catch (error) {
    console.error('Error selecting repo:', error);
    res.status(500).json({ error: 'Failed to select repository' });
  }
});

router.get('/directories/:owner/:repo', requireAuth, requireGitHub, async (req, res) => {
  const { owner, repo } = req.params;

  try {
    const response = await githubApi.get(`/repos/${owner}/${repo}/contents`, {
      headers: {
        Authorization: `Bearer ${req.githubToken}`,
      },
    });

    const directories = response.data
      .filter(item => item.type === 'dir')
      .map(dir => ({
        name: dir.name,
        path: dir.path,
        type: dir.type
      }));

    res.json(directories);
  } catch (error) {
    console.error('Error fetching directories:', error);
    res.status(500).json({ error: 'Failed to fetch directories' });
  }
});

router.post('/set-content-directory', requireAuth, requireGitHub, async (req, res) => {
  const { directory } = req.body;
  
  if (!directory) {
    return res.status(400).json({ error: 'Directory path is required' });
  }

  try {
    const user = await dbGet('SELECT selected_repo FROM users WHERE id = ?', [req.session.user.id]);
    
    if (!user.selected_repo) {
      throw new Error('No repository selected');
    }

    await githubApi.get(`/repos/${user.selected_repo}/contents/${directory}`, {
      headers: {
        Authorization: `Bearer ${req.githubToken}`,
      },
    });

    await dbRun(
      'UPDATE users SET content_directory = ? WHERE id = ?',
      [directory, req.session.user.id]
    );
    
    req.session.user = {
      ...req.session.user,
      content_directory: directory
    };

    res.json({ success: true });
  } catch (error) {
    console.error('Error setting content directory:', error);
    res.status(500).json({ error: 'Failed to set content directory' });
  }
});

export { router as default };
