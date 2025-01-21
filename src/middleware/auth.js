export const requireAuth = (req, res, next) => {
  if (!req.session.user) {
    return res.redirect('/auth/login');
  }
  next();
};

export const requireGitHub = async (req, res, next) => {
  if (!req.session.user?.github_access_token) {
    return res.status(401).json({ error: 'GitHub account not connected' });
  }
  req.githubToken = req.session.user.github_access_token;
  next();
};
