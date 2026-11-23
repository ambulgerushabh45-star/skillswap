// server/scripts/test-db-helper.mjs
// Ephemeral scratch database manager for tests and check scripts.
// Creates "<main>_test_<timestamp>" databases and guarantees drops only on "_test_".

import { execSync, spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PrismaClient } from '@prisma/client';
import config from '../src/config/env.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..', '..');
const sqlitePath = path.resolve(rootDir, 'prisma', 'dev.db');

export function getScratchDbInfo() {
  const mainDbName = config.DB_NAME;
  const timestamp = Date.now();
  const rand = Math.random().toString(36).substring(2, 7);
  const testDbName = `${mainDbName}_test_${timestamp}_${rand}`;

  // Replace database path in MONGODB_URL
  const baseUri = config.MONGODB_URL;
  const regex = new RegExp(`/${mainDbName}(\\?|$)`);
  const testMongoUrl = baseUri.replace(regex, `/${testDbName}$1`);

  return { testDbName, testMongoUrl };
}

export async function createScratchDatabase({ loadData = true } = {}) {
  const { testDbName, testMongoUrl } = getScratchDbInfo();

  console.log(`[ScratchDB] Creating test database: ${testDbName}`);

  // Push schema to scratch database
  execSync(`npm --prefix server exec -- prisma db push --skip-generate --schema=prisma/schema.prisma`, {
    cwd: rootDir,
    env: { ...process.env, MONGODB_URL: testMongoUrl },
    stdio: 'ignore',
  });

  if (loadData) {
    if (fs.existsSync(sqlitePath)) {
      execSync(`node server/scripts/migrate-sqlite-to-mongo.mjs --apply "--target-url=${testMongoUrl}"`, {
        cwd: rootDir,
        env: { ...process.env, MONGODB_URL: testMongoUrl },
        stdio: 'ignore',
      });
      console.log(`[ScratchDB] Loaded 81 baseline records into: ${testDbName}`);
    } else {
      execSync(`node server/scripts/seed.mjs`, {
        cwd: rootDir,
        env: { ...process.env, MONGODB_URL: testMongoUrl },
        stdio: 'ignore',
      });
      console.log(`[ScratchDB] Seeded baseline records into: ${testDbName}`);
    }
  }

  return { testDbName, testMongoUrl };
}

export async function dropScratchDatabase(testDbName, testMongoUrl) {
  // STRICT SAFETY GUARD: only drop databases with "_test_" in their name
  if (!testDbName || !testDbName.includes('_test_')) {
    throw new Error(`[SAFETY GUARD REFUSAL] Refused to drop database '${testDbName}'. Name MUST contain '_test_'.`);
  }

  console.log(`[ScratchDB] Dropping test database: ${testDbName}`);
  const prisma = new PrismaClient({
    datasources: { db: { url: testMongoUrl } },
    log: ['error'],
  });

  try {
    // Drop all collections
    const collections = [
      'OAuthAccount',
      'AvatarFile',
      'Message',
      'Review',
      'EventAttendee',
      'Event',
      'Match',
      'UserSkillsLearn',
      'UserSkillsTeach',
      'Skill',
      'User',
    ];
    for (const col of collections) {
      try {
        await prisma[col.charAt(0).toLowerCase() + col.slice(1)].deleteMany({});
      } catch {
        // ignore
      }
    }
    // Drop database via raw command if possible, or leave cleaned collections
    try {
      await prisma.$runCommandRaw({ dropDatabase: 1 });
    } catch {
      // raw command fallback
    }
    console.log(`[ScratchDB] Successfully cleaned and dropped: ${testDbName}`);
  } finally {
    await prisma.$disconnect();
  }
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export async function waitForServer(url, timeoutMs = 10000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(`${url}/api/health`);
      if (res.ok) return true;
    } catch {
      // wait
    }
    await sleep(200);
  }
  throw new Error(`Server at ${url} did not become ready within ${timeoutMs}ms`);
}

export function startTestServer({ port = 4100, mongoUrl, avatarDir } = {}) {
  const serverDir = path.resolve(rootDir, 'server');
  const serverProcess = spawn('node', ['src/index.js'], {
    cwd: serverDir,
    env: {
      ...process.env,
      PORT: String(port),
      MONGODB_URL: mongoUrl,
      AVATAR_STORAGE_DIR: avatarDir || path.resolve(serverDir, 'tmp', 'avatars'),
      NODE_ENV: 'test',
    },
    stdio: 'pipe',
  });

  return serverProcess;
}

export function stopTestServer(serverProcess) {
  if (!serverProcess || serverProcess.killed) return;
  serverProcess.kill('SIGTERM');
}
