import config from './config/env.js';
import { prisma } from './db/prisma.js';
import { createApp } from './app.js';
import { registerProcessErrorHandlers } from './middleware/logger.js';

// Handle unhandled rejections and uncaught exceptions with redacted logging and non-zero exit
registerProcessErrorHandlers();

const app = createApp();

const server = app.listen(config.PORT, () => {
  console.log(`\n==============================================`);
  console.log(`SkillSwap Express Server started successfully!`);
  console.log(`Port:            ${config.PORT}`);
  console.log(`Environment:     ${config.NODE_ENV}`);
  console.log(`Database:        ${config.DB_NAME}`);
  console.log(`Allowed Origins: ${config.ALLOWED_ORIGINS.join(', ')}`);
  console.log(`==============================================\n`);
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`\n[FATAL] Port ${config.PORT} is already in use.`);
    console.error(`Express server cannot start. Please free port ${config.PORT} or check running processes.\n`);
  } else {
    console.error(`\n[FATAL] Server failed to start:`, err);
  }
  process.exit(1);
});

// Graceful shutdown handling
let isShuttingDown = false;
async function gracefulShutdown(signal) {
  if (isShuttingDown) return;
  isShuttingDown = true;

  console.log(`\n[SHUTDOWN] Received ${signal}. Closing server gracefully...`);

  server.close(async () => {
    console.log('[SHUTDOWN] HTTP server closed.');
    try {
      await prisma.$disconnect();
      console.log('[SHUTDOWN] Prisma disconnected.');
      process.exit(0);
    } catch (err) {
      console.error('[SHUTDOWN ERROR] Failed disconnecting Prisma:', err);
      process.exit(1);
    }
  });

  // Force close after 5 seconds if not finished
  setTimeout(() => {
    console.error('[SHUTDOWN] Force exiting after 5s timeout.');
    process.exit(1);
  }, 5000).unref();
}

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

