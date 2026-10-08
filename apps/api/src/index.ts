import { buildServer } from './server.js';
import { env } from './config/env.js';
import { closeDatabaseConnection } from './db/client.js';

async function start(): Promise<void> {
  const app = await buildServer();

  // Graceful shutdown handling
  let isShuttingDown = false;
  const gracefulShutdown = async (signal: string) => {
    if (isShuttingDown) return;
    isShuttingDown = true;
    app.log.info({ signal }, 'Graceful shutdown initiated...');

    try {
      await app.close();
      app.log.info('Fastify server closed.');
      await closeDatabaseConnection();
      app.log.info('Database connections closed.');
      process.exit(0);
    } catch (err) {
      app.log.error({ err }, 'Error during graceful shutdown');
      process.exit(1);
    }
  };

  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

  try {
    await app.listen({ port: env.PORT, host: env.HOST });
    app.log.info(`🚀 Restaurant OS API listening at http://${env.HOST}:${env.PORT}`);
    app.log.info(`Environment: ${env.NODE_ENV}`);
  } catch (err) {
    app.log.error(err, 'Failed to start API server');
    process.exit(1);
  }
}

start();
