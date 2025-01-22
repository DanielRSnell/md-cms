import express from 'express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import nunjucks from 'nunjucks';

const __dirname = dirname(fileURLToPath(import.meta.url));

export function configureApp(app) {
  // Nunjucks setup
  const env = nunjucks.configure('src/views', {
    autoescape: true,
    express: app,
    noCache: process.env.NODE_ENV !== 'production'
  });

  // Add custom filters
  env.addFilter('currentYear', () => new Date().getFullYear());
  env.addFilter('date', (date) => {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  });

  // View engine setup
  app.set('view engine', 'njk');

  // Middleware setup
  app.use(express.static(join(dirname(__dirname), 'public')));
  app.use(express.urlencoded({ extended: true }));
  app.use(express.json());

  return app;
}
