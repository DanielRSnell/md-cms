import { Router } from 'express';
import { dbGet } from '../../db.js';
import { requireAuth, requireGitHub } from '../../middleware/auth.js';
import { githubApi } from '../../config/github.js';
import { Buffer } from 'buffer';

const router = Router();

router.get('/contents/:owner/:repo/*', requireAuth, requireGitHub, async (req, res) => {
  const { owner, repo } = req.params;
  const path = req.params[0] || '';

  try {
    const response = await githubApi.get(`/repos/${owner}/${repo}/contents/${path}`, {
      headers: {
        'Authorization': `Bearer ${req.githubToken}`,
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'Markdown-CMS'
      }
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
          download_url: item.download_url,
          fileType: item.type === 'dir' ? 'directory' : 
                   item.name.endsWith('.mdx') ? 'mdx' : 'markdown'
        }));
      res.json(contents);
    } else {
      res.json({
        name: response.data.name,
        path: response.data.path,
        type: response.data.type,
        sha: response.data.sha,
        size: response.data.size,
        url: response.data.url,
        download_url: response.data.download_url,
        fileType: response.data.type === 'dir' ? 'directory' : 
                 response.data.name.endsWith('.mdx') ? 'mdx' : 'markdown'
      });
    }
  } catch (error) {
    console.error('Error fetching contents:', error.response?.data || error.message);
    res.status(error.response?.status || 500).json({ 
      error: 'Failed to fetch contents',
      details: error.response?.data?.message || error.message
    });
  }
});

router.get('/file/:owner/:repo/*', requireAuth, requireGitHub, async (req, res) => {
  const { owner, repo } = req.params;
  const path = req.params[0] || '';

  try {
    const response = await githubApi.get(`/repos/${owner}/${repo}/contents/${path}`, {
      headers: {
        'Authorization': `Bearer ${req.githubToken}`,
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'Markdown-CMS'
      }
    });

    if (response.data.type !== 'file') {
      throw new Error('Not a file');
    }

    const content = Buffer.from(response.data.content, 'base64').toString('utf8');
    
    let frontMatter = {};
    let mainContent = content;

    const frontMatterRegex = /^---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)$/;
    const match = content.match(frontMatterRegex);
    
    if (match) {
      try {
        frontMatter = JSON.parse(match[1].trim());
        mainContent = match[2].trim();
      } catch (e) {
        console.warn('Failed to parse front matter:', e);
        mainContent = content;
      }
    }

    res.json({
      content: mainContent,
      frontMatter,
      sha: response.data.sha,
      path: response.data.path,
      name: response.data.name,
      type: path.endsWith('.mdx') ? 'mdx' : 'markdown'
    });
  } catch (error) {
    console.error('Error fetching file:', error.response?.data || error.message);
    res.status(error.response?.status || 500).json({ 
      error: 'Failed to fetch file',
      details: error.response?.data?.message || error.message
    });
  }
});

router.post('/save', requireAuth, requireGitHub, async (req, res) => {
  const { path, content, frontMatter, sha } = req.body;

  if (!path || content === undefined) {
    return res.status(400).json({ error: 'Path and content are required' });
  }

  try {
    const pathParts = path.split('/');
    const owner = pathParts[0];
    const repo = pathParts[1];
    const filePath = pathParts.slice(2).join('/');

    const fileContent = `---\n${JSON.stringify(frontMatter, null, 2)}\n---\n\n${content}`;
    const encodedContent = Buffer.from(fileContent).toString('base64');

    const response = await githubApi.put(`/repos/${owner}/${repo}/contents/${filePath}`, {
      message: `Update ${filePath} via Markdown CMS`,
      content: encodedContent,
      sha: sha
    }, {
      headers: {
        'Authorization': `Bearer ${req.githubToken}`,
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'Markdown-CMS'
      }
    });

    res.json({
      success: true,
      sha: response.data.content.sha,
      commit: response.data.commit
    });
  } catch (error) {
    console.error('Error saving file:', error.response?.data || error.message);
    res.status(error.response?.status || 500).json({ 
      error: 'Failed to save file',
      details: error.response?.data?.message || error.message
    });
  }
});

export { router as filesRouter };
