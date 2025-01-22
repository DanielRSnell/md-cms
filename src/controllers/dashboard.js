import { ProjectModel } from '../db/models/project.js';

export const dashboardController = {
  async show(req, res) {
    try {
      if (!req.session.user) {
        return res.redirect('/auth/login');
      }

      const projects = await ProjectModel.findByUser(req.session.user.id);
      res.render('dashboard', { projects });
    } catch (error) {
      console.error('Error loading dashboard:', error);
      res.status(500).render('error', { error: 'Failed to load dashboard' });
    }
  }
};
