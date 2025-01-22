import { Router } from 'express';
import { dbGet } from '../../db.js';
import { requireAuth, requireGitHub } from '../../middleware/auth.js';
import { githubApi } from '../../utils/github.js';

const router = Router();

router.get('/contents/:owner/:repo/*', requireAuth, requireGitHub, async (req, res) => {
  const { owner, repo } = req.params;
  const path = req.params[0] || '';

  try {
    const response = await githubApi.get(`/repos/${owner}/${repo}/contents/${path}`, {
      headers: {
        Authorization: `Bearer ${req.githubToken}`,
      },
    });

    if (Array.isArray(response.data)) {
      const contents = response.data
        .map(item => ({
          name: item.name,
          path: item.path,
          type: item.type,
          sha: item.sha,
          size: item.size,
          url: item.url,
          fileType: item.type === 'dir' ? 'directory' : 
                   item.name.endsWith('.mdx') ? 'mdx' : 
                   item.name.endsWith('.md') ? 'markdown' : 
                   'other'
        }));
      res.json(contents);
    } else {
      res.json(response.data);
    }
  } catch (error) {
    console.error('Error fetching contents:', error);
    res.status(500).json({ error: 'Failed to fetch contents' });
  }
});

export { router as default };
