import { Router } from 'express';
import { dbGet } from '../../db.js';
import { requireAuth, requireGitHub } from '../../middleware/auth.js';
import { githubApi } from '../../utils/github.js';
import matter from 'gray-matter';

const router = Router();

router.get('/contents/:owner/:repo/*', requireAuth, requireGitHub, async (req, res) => {
  const { owner, repo } = req.params;
  const path = req.params[0] || '';
  const user = await dbGet('SELECT content_directory FROM users WHERE id = ?', [req.session.user.id]);

  try {
    const fullPath = user.content_directory 
      ? `${user.content_directory}/${path}`.replace(/\/+/g, '/')
      : path;

    const response = await githubApi.get(`/repos/${owner}/${repo}/contents/${fullPath}`, {
      headers: {
        Authorization: `Bearer ${req.githubToken}`,
      },
    });

    if (Array.isArray(response.data)) {
      const contents = response.data
        .filter(item => item.type === 'dir' || item.name.endsWith('.md') || item.name.endsWith('.mdx'))
        .map(item => ({
          name: item.name,
          path: item.path,
          type: item.type,
          sha: item.sha,
          size: item.size,
          url: item.url,
          fileType: item.type === 'dir' ? 'directory' : 
                   item.name.endsWith('.mdx') ? 'mdx' : 'markdown'
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

router.get('/file', requireAuth, requireGitHub, async (req, res) => {
  const { path, repo } = req.query;

  if (!path || !repo) {
    return res.status(400).json({ error: 'Path and repo are required' });
  }

  try {
    const response = await githubApi.get(`/repos/${repo}/contents/${path}`, {
      headers: {
        Authorization: `Bearer ${req.githubToken}`,
      },
    });

    const content = Buffer.from(response.data.content, 'base64').toString();
    const isMDX = path.endsWith('.mdx');
    
    const { data: frontMatter, content: markdownContent } = matter(content);
    res.json({
      frontMatter,
      content: markdownContent,
      sha: response.data.sha,
      type: isMDX ? 'mdx' : 'markdown'
    });
  } catch (error) {
    console.error('Error fetching file:', error);
    res.status(500).json({ error: 'Failed to fetch file' });
  }
});

router.post('/save', requireAuth, requireGitHub, async (req, res) => {
  const { path, content, frontMatter, sha } = req.body;
  const user = await dbGet('SELECT selected_repo FROM users WHERE id = ?', [req.session.user.id]);

  if (!path || content === undefined || !frontMatter || !sha) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    const fileContent = matter.stringify(content, frontMatter);
    const encodedContent = Buffer.from(fileContent).toString('base64');

    const response = await githubApi.put(
      `/repos/${user.selected_repo}/contents/${path}`,
      {
        message: `Update ${path}`,
        content: encodedContent,
        sha: sha
      },
      {
        headers: {
          Authorization: `Bearer ${req.githubToken}`,
        },
      }
    );

    res.json({ 
      success: true,
      sha: response.data.content.sha
    });
  } catch (error) {
    console.error('Error saving file:', error);
    if (error.response?.status === 409) {
      return res.status(409).json({ 
        error: 'File has been modified',
        details: 'Please refresh and try again'
      });
    }
    res.status(500).json({ error: 'Failed to save file' });
  }
});

export { router as default };
