import { Router } from 'express';
import { prisma } from '../db/prisma.js';
import { rateLimit, getClientIp } from '../lib/rate-limit.js';
import { sendTooManyRequests } from '../lib/api-error.js';

const router = Router();

export async function defaultDbPing(prismaClient = prisma) {
  return prismaClient.$runCommandRaw({ ping: 1 });
}

router.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

router.get('/health/db', async (req, res) => {
  const ip = getClientIp(req);
  const rl = rateLimit(`health:db:${ip}`, { limit: 30, windowSeconds: 60 });
  if (!rl.ok) {
    return sendTooManyRequests(res, rl.retryAfterSeconds);
  }

  const pingFn = req.app?.locals?.dbPing || defaultDbPing;

  try {
    let timer;
    const timeoutPromise = new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error('DB ping timeout')), 3000);
    });

    await Promise.race([
      Promise.resolve().then(() => pingFn(prisma)),
      timeoutPromise,
    ]);

    if (timer) clearTimeout(timer);
    return res.status(200).json({ status: 'ok' });
  } catch {
    return res.status(503).json({ status: 'unavailable' });
  }
});

export default router;
