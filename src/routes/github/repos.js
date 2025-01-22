import { Router } from 'express';
import { dbGet, dbRun } from '../../db.js';
import { requireAuth, requireGitHub } from '../../middleware/auth.js';
import { githubApi } from '../../config/github.js';

const router = Router();

router.get('/list', requireAuth, requireGitHub, async (req, res) => {
  try {
    const response = await githubApi.get('/user/repos', {
      headers: {
        'Authorization': `Bearer ${req.githubToken}`,
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'Markdown-CMS'
      },
      params: {
        sort: 'updated',
        per_page: 100,
        visibility: 'all',
        affiliation: 'owner,collaborator,organization_member'
      }
    });

    const repos = response.data.map(repo => ({
      id: repo.id,
      name: repo.name,
      full_name: repo.full_name,
      default_branch: repo.default_branch,
      private: repo.private
    }));

    res.json(repos);
  } catch (error) {
    console.error('Error fetching repos:', error.response?.data || error.message);
    res.status(error.response?.status || 500).json({ 
      error: 'Failed to fetch repositories',
      details: error.response?.data?.message || error.message
    });
  }
});

router.post('/select', requireAuth, requireGitHub, async (req, res) => {
  const { repo } = req.body;
  
  if (!repo) {
    return res.status(400).json({ error: 'Repository name is required' });
  }

  try {
    // Verify repository access
    await githubApi.get(`/repos/${repo}`, {
      headers: {
        'Authorization': `Bearer ${req.githubToken}`,
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'Markdown-CMS'
      }
    });

    // Update user record with selected repo
    await dbRun(
      'UPDATE users SET selected_repo = ?, content_directory = NULL WHERE id = ?',
      [repo, req.session.user.id]
    );

    // Get updated user data
    const user = await dbGet('SELECT * FROM users WHERE id = ?', [req.session.user.id]);
    
    // Update session with new repo info
    req.session.user = {
      ...req.session.user,
      selected_repo: repo,
      content_directory: null
    };

    res.json({ success: true });
  } catch (error) {
    console.error('Error selecting repo:', error.response?.data || error.message);
    res.status(error.response?.status || 500).json({ 
      error: 'Failed to select repository',
      details: error.response?.data?.message || error.message
    });
  }
});

export { router as reposRouter };
