export const requireAuth = (req, res, next) => {
  if (!req.session.user) {
    return res.redirect('/auth/login');
  }
  next();
};

export const requireGitHub = async (req, res, next) => {
  if (!req.session.user?.github_access_token) {
    if (req.xhr || req.headers.accept?.includes('application/json')) {
      return res.status(401).json({ error: 'GitHub account not connected' });
    }
    return res.redirect('/settings?error=github_required');
  }
  req.githubToken = req.session.user.github_access_token;
  next();
};

export const requireProject = async (req, res, next) => {
  if (!req.project) {
    return res.status(404).json({ error: 'Project not found' });
  }
  if (req.project.user_id !== req.session.user.id) {
    return res.status(403).json({ error: 'Not authorized to access this project' });
  }
  next();
};
