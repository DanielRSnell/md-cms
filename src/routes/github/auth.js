// Update the GitHub callback handler
// After successful GitHub authentication:
await dbRun(
  `UPDATE users 
   SET github_id = ?, github_username = ?, github_access_token = ? 
   WHERE id = ?`,
  [githubUser.id, githubUser.login, accessToken, state]
);

const user = await dbGet('SELECT * FROM users WHERE id = ?', [state]);
req.session.user = {
  id: user.id,
  email: user.email,
  github_id: user.github_id,
  github_username: user.github_username,
  github_access_token: user.github_access_token
};

req.session.save((err) => {
  if (err) {
    console.error('Session save error:', err);
  }
  res.redirect('/dashboard');
});
