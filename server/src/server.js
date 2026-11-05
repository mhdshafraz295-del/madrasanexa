
import app from './app.js';
import { env } from './config/env.js';
import { initSubscriptionStatusJob, stopSubscriptionStatusJob } from './jobs/subscription-status.job.js';
import { startNotificationWorker, stopNotificationWorker } from './jobs/notification-worker.job.js';

const PORT = env.PORT || 5000;

const server = app.listen(PORT, () => {
  console.log(`🚀 MadrasaNexa Backend Server running in [${env.NODE_ENV}] mode on port ${PORT}`);
  console.log(`🔗 Health Check: http://localhost:${PORT}/api/health`);
  if (env.EMAIL_PROVIDER === 'smtp') {
    console.log(`📧 SMTP Config: provider=${env.EMAIL_PROVIDER}, host=${env.SMTP_HOST || 'not set'}, port=${env.SMTP_PORT}, secure=${env.SMTP_SECURE}`);
  }

  // Start background jobs only in non-test environments
  if (env.NODE_ENV !== 'test' && process.env.NODE_ENV !== 'test') {
    // Start scheduled subscription status worker
    initSubscriptionStatusJob();
    // Start automatic notification worker
    startNotificationWorker();
  }
});

// Graceful shutdown handling
const gracefulShutdown = (signal) => {
  console.log(`\nReceived ${signal}. Shutting down gracefully...`);
  stopSubscriptionStatusJob();
  stopNotificationWorker();
  server.close(() => {
    console.log('Http server closed.');
    process.exit(0);
  });

  // Force close after 10s if connections linger
  setTimeout(() => {
    console.error('Forcing shutdown after timeout.');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

export default server;
