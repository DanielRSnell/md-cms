import { dbGet, dbRun, dbAll } from '../index.js';

export const ProjectModel = {
  async findById(id) {
    return await dbGet('SELECT * FROM projects WHERE id = ?', [id]);
  },

  async findByUser(userId) {
    return await dbAll(
      'SELECT * FROM projects WHERE user_id = ? ORDER BY updated_at DESC',
      [userId]
    );
  },

  async create({ id, user_id, name, description, repository }) {
    await dbRun(
      `INSERT INTO projects (id, user_id, name, description, repository) 
       VALUES (?, ?, ?, ?, ?)`,
      [id, user_id, name, description, repository]
    );
    return await this.findById(id);
  },

  async updateContentDirectory(id, contentDirectory) {
    await dbRun(
      'UPDATE projects SET content_directory = ? WHERE id = ?',
      [contentDirectory, id]
    );
    return await this.findById(id);
  },

  async update(id, { name, description }) {
    await dbRun(
      'UPDATE projects SET name = ?, description = ? WHERE id = ?',
      [name, description, id]
    );
    return await this.findById(id);
  },

  async delete(id) {
    return await dbRun('DELETE FROM projects WHERE id = ?', [id]);
  },

  async exists(id) {
    const result = await dbGet('SELECT 1 FROM projects WHERE id = ?', [id]);
    return !!result;
  }
};
