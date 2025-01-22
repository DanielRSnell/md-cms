import { dbGet, dbRun, dbAll } from '../index.js';

export const UserModel = {
  async findById(id) {
    return await dbGet('SELECT * FROM users WHERE id = ?', [id]);
  },

  async findByEmail(email) {
    return await dbGet('SELECT * FROM users WHERE email = ?', [email.toLowerCase()]);
  },

  async findByGithubId(githubId) {
    return await dbGet('SELECT * FROM users WHERE github_id = ?', [githubId]);
  },

  async create({ id, email, password }) {
    await dbRun(
      'INSERT INTO users (id, email, password) VALUES (?, ?, ?)',
      [id, email.toLowerCase(), password]
    );
    return await this.findById(id);
  },

  async updateGitHub(userId, { github_id, github_username, github_access_token }) {
    await dbRun(
      `UPDATE users 
       SET github_id = ?, github_username = ?, github_access_token = ? 
       WHERE id = ?`,
      [github_id, github_username, github_access_token, userId]
    );
    return await this.findById(userId);
  },

  async exists(id) {
    const result = await dbGet('SELECT 1 FROM users WHERE id = ?', [id]);
    return !!result;
  },

  async updatePassword(id, password) {
    await dbRun(
      'UPDATE users SET password = ? WHERE id = ?',
      [password, id]
    );
    return await this.findById(id);
  },

  async delete(id) {
    return await dbRun('DELETE FROM users WHERE id = ?', [id]);
  }
};
