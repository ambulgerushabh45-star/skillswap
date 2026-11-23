import { PrismaClient } from '@prisma/client';
import config from '../config/env.js';

const globalForPrisma = globalThis;

export const prisma =
  globalForPrisma.serverPrisma ??
  new PrismaClient({
    datasources: {
      db: {
        url: config.MONGODB_URL,
      },
    },
    log: config.IS_PRODUCTION ? ['error'] : ['error', 'warn'],
  });

if (!config.IS_PRODUCTION) {
  globalForPrisma.serverPrisma = prisma;
}

export default prisma;

