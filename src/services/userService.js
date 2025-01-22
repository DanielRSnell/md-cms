import { dbGet, dbRun } from '../db/index.js';

class UserService {
  async findById(id) {
    return await dbGet('SELECT * FROM users WHERE id = ?', [id]);
  }

  async findByGithubId(githubId) {
    return await dbGet('SELECT * FROM users WHERE github_id = ?', [githubId]);
  }

  async hasGitHubConnected(userId) {
    const user = await this.findById(userId);
    return user && user.github_id ? true : false;
  }

  async updateGitHubConnection(userId, { githubId, username, accessToken }) {
    const result = await dbRun(
      `UPDATE users 
       SET github_id = ?, 
           github_username = ?, 
           github_access_token = ?,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [githubId.toString(), username, accessToken, userId]
    );

    if (!result) {
      throw new Error('Failed to update user record');
    }

    return await this.findById(userId);
  }

  async disconnectGitHub(userId) {
    const result = await dbRun(
      `UPDATE users 
       SET github_id = NULL, 
           github_username = NULL, 
           github_access_token = NULL, 
           selected_repo = NULL,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [userId]
    );

    if (!result) {
      throw new Error('Failed to disconnect GitHub');
    }

    return await this.findById(userId);
  }

  async hasProjects(userId) {
    const result = await dbGet(
      'SELECT COUNT(*) as count FROM projects WHERE user_id = ?', 
      [userId]
    );
    return result.count > 0;
  }
}

export const userService = new UserService();
