import 'dotenv/config';
import express from 'express';
import session from 'express-session';
import { configureApp } from './config/app.js';
import { createSessionConfig, validateSessionConfig } from './config/session.js';
import { notFoundHandler, errorHandler } from './middleware/errorHandler.js';
import { setupGracefulShutdown } from './utils/shutdown.js';
import { router } from './routes/index.js';

// Create Express app
const app = express();

// Configure app (middleware, view engine, etc.)
configureApp(app);

// Session configuration
validateSessionConfig();
app.use(session(createSessionConfig(process.env.NODE_ENV === 'production')));

// Make user available to all templates
app.use((req, res, next) => {
  res.locals.user = req.session.user;
  next();
});

// Mount main router
app.use('/', router);

// Error handling
app.use(notFoundHandler);
app.use(errorHandler);

// Start server
const port = process.env.PORT || 3000;
const server = app.listen(port, () => {
  console.log(`Server running on port ${port}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});

// Setup graceful shutdown
setupGracefulShutdown(server);

// Handle unhandled errors
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

export default app;
