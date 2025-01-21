// Add these new routes to your existing github.js file

router.post('/select-repo', requireAuth, requireGitHub, asyncHandler(async (req, res) => {
  const { repo } = req.body;
  
  if (!repo) {
    return res.status(400).json({ error: 'Repository name is required' });
  }

  try {
    // First, verify repository access
    await githubApi.get(`/repos/${repo}`, {
      headers: {
        Authorization: `Bearer ${req.githubToken}`,
      },
    });

    // Update user record, clearing content directory when repo changes
    await dbRun(
      'UPDATE users SET selected_repo = ?, content_directory = NULL WHERE id = ?',
      [repo, req.session.user.id]
    );
    
    // Update session
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
}));

router.get('/directories/:owner/:repo', requireAuth, requireGitHub, asyncHandler(async (req, res) => {
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
}));

router.post('/set-content-directory', requireAuth, requireGitHub, asyncHandler(async (req, res) => {
  const { directory } = req.body;
  
  if (!directory) {
    return res.status(400).json({ error: 'Directory path is required' });
  }

  try {
    const user = await dbGet('SELECT selected_repo FROM users WHERE id = ?', [req.session.user.id]);
    
    if (!user.selected_repo) {
      throw new Error('No repository selected');
    }

    // Verify directory exists
    await githubApi.get(`/repos/${user.selected_repo}/contents/${directory}`, {
      headers: {
        Authorization: `Bearer ${req.githubToken}`,
      },
    });

    // Update user record
    await dbRun(
      'UPDATE users SET content_directory = ? WHERE id = ?',
      [directory, req.session.user.id]
    );
    
    // Update session
    req.session.user = {
      ...req.session.user,
      content_directory: directory
    };

    res.json({ success: true });
  } catch (error) {
    console.error('Error setting content directory:', error);
    res.status(500).json({ error: 'Failed to set content directory' });
  }
}));

// Update the existing contents route to use the content directory
router.get('/contents/:owner/:repo/*', requireAuth, requireGitHub, asyncHandler(async (req, res) => {
  const { owner, repo } = req.params;
  const path = req.params[0] || '';
  const user = await dbGet('SELECT content_directory FROM users WHERE id = ?', [req.session.user.id]);

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
}));
