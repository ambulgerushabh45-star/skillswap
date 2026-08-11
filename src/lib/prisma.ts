// Prisma Client Singleton Instance
// Prevents exhausting database connections during local Next.js hot reloads

import { PrismaClient } from "@prisma/client";

// Global type declaration for Prisma in development mode
const globalForPrisma = global as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    log: ["query", "error", "warn"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
