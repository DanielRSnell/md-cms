import { db } from '../db/index.js';

export function setupGracefulShutdown(server) {
  // Handle SIGTERM
  process.on('SIGTERM', () => {
    console.log('SIGTERM received. Shutting down gracefully...');
    gracefulShutdown(server);
  });

  // Handle SIGINT
  process.on('SIGINT', () => {
    console.log('SIGINT received. Shutting down gracefully...');
    gracefulShutdown(server);
  });

  // Handle uncaught exceptions
  process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
    gracefulShutdown(server);
  });

  // Handle unhandled promise rejections
  process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    gracefulShutdown(server);
  });
}

function gracefulShutdown(server) {
  console.log('Starting graceful shutdown...');

  server.close(() => {
    console.log('HTTP server closed.');
    
    db.close((err) => {
      if (err) {
        console.error('Error closing database:', err);
        process.exit(1);
      }
      console.log('Database connection closed.');
      process.exit(0);
    });
  });

  // Force shutdown after 30 seconds
  setTimeout(() => {
    console.error('Could not close connections in time, forcefully shutting down');
    process.exit(1);
  }, 30000);
}
