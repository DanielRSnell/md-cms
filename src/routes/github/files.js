import { Router } from 'express';
import { dbGet } from '../../db.js';
import { requireAuth, requireGitHub } from '../../middleware/auth.js';
import { githubApi } from '../../config/github.js';
import { Buffer } from 'buffer';

const router = Router();

function parseFrontMatter(content) {
  const match = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!match) return { frontMatter: {}, content };

  const [, frontMatterStr, mainContent] = match;
  const frontMatter = {};

  // Parse front matter lines
  frontMatterStr.split('\n').forEach(line => {
    const [key, ...valueParts] = line.split(':');
    if (!key || !valueParts.length) return;

    let value = valueParts.join(':').trim();
    
    // Handle arrays
    if (value.startsWith('[') && value.endsWith(']')) {
      try {
        value = value.slice(1, -1).split(',').map(v => v.trim());
      } catch (e) {
        console.warn('Failed to parse array:', value);
      }
    }
    // Handle numbers
    else if (!isNaN(value)) {
      value = Number(value);
    }
    // Handle booleans
    else if (value === 'true') {
      value = true;
    }
    else if (value === 'false') {
      value = false;
    }
    // Handle quoted strings
    else if ((value.startsWith('"') && value.endsWith('"')) || 
             (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }

    frontMatter[key.trim()] = value;
  });

  return {
    frontMatter,
    content: mainContent.trim()
  };
}

function stringifyFrontMatter(frontMatter) {
  if (!frontMatter || Object.keys(frontMatter).length === 0) return '';

  const lines = Object.entries(frontMatter).map(([key, value]) => {
    if (Array.isArray(value)) {
      return `${key}: [${value.join(', ')}]`;
    }
    if (typeof value === 'string' && (value.includes(':') || value.includes('"'))) {
      return `${key}: "${value}"`;
    }
    return `${key}: ${value}`;
  });

  return `---\n${lines.join('\n')}\n---\n\n`;
}

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

    const fileContent = Buffer.from(response.data.content, 'base64').toString('utf8');
    const { frontMatter, content } = parseFrontMatter(fileContent);

    res.json({
      content,
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

    const fileContent = stringifyFrontMatter(frontMatter) + content;
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
