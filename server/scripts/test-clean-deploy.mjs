// server/scripts/test-clean-deploy.mjs
// Proves that SkillSwap builds and runs from a clean directory without local artifacts.
// Tests the exact Render buildCommand and startCommand against an isolated scratch MongoDB database.

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execSync, spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createScratchDatabase, dropScratchDatabase } from './test-db-helper.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..', '..');
const deployTestDir = path.resolve(projectRoot, '..', 'skillswap-deploy-test');

const EXCLUDED_NAMES = new Set([
  'node_modules',
  'dist',
  'storage',
  'backups',
  'tmp',
  '.git',
  '.agent',
  '.agents',
  '.gemini',
]);

function copyDirClean(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  const entries = fs.readdirSync(src, { withFileTypes: true });

  for (const entry of entries) {
    const name = entry.name;
    if (EXCLUDED_NAMES.has(name)) continue;
    if (name.startsWith('.env')) continue;
    if (name.endsWith('.db') || name.includes('backup')) continue;

    const srcPath = path.join(src, name);
    const destPath = path.join(dest, name);

    if (entry.isDirectory()) {
      copyDirClean(srcPath, destPath);
    } else if (entry.isFile()) {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

function stopChild(child) {
  if (!child || child.exitCode !== null || child.killed) return;
  if (process.platform === 'win32') {
    spawnSync('taskkill', ['/PID', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
  } else {
    child.kill('SIGTERM');
  }
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function waitForHealth(url, timeoutMs = 15000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(`${url}/api/health`);
      if (res.ok) return true;
    } catch {
      // wait
    }
    await sleep(250);
  }
  throw new Error(`Timed out waiting for health at ${url}`);
}

async function main() {
  console.log('======================================================');
  console.log('SkillSwap Clean Scratch Build & Deployment Proof (D2)');
  console.log(`Source: ${projectRoot}`);
  console.log(`Deploy Test Directory: ${deployTestDir}`);
  console.log('======================================================\n');

  // 1. Clean previous test directory if exists
  if (fs.existsSync(deployTestDir)) {
    console.log('Cleaning up existing deploy test directory...');
    fs.rmSync(deployTestDir, { recursive: true, force: true });
  }

  // 2. Copy clean source files
  console.log('[1/5] Copying clean source tree (omitting node_modules, .env*, dist, storage)...');
  copyDirClean(projectRoot, deployTestDir);
  console.log('✓ Clean source copy created.\n');

  // 3. Execute exact Render buildCommand
  console.log('[2/5] Running Render buildCommand:');
  const buildCmd = 'npm --prefix server install && npm --prefix client install && npx --prefix server prisma generate --schema=prisma/schema.prisma && npm --prefix client run build';
  console.log(`  > ${buildCmd}\n`);
  execSync(buildCmd, {
    cwd: deployTestDir,
    stdio: 'inherit',
    env: { ...process.env },
  });
  console.log('\n✓ Render buildCommand succeeded with zero errors.\n');

  // 4. Create scratch database on MongoDB 27018
  console.log('[3/5] Spinning up scratch MongoDB database for clean deploy test...');
  const { testDbName, testMongoUrl } = await createScratchDatabase({ loadData: true });

  const randomSecret = crypto.randomBytes(32).toString('hex');
  const TEST_PORT = 4200;
  const TEST_URL = `http://localhost:${TEST_PORT}`;

  let serverProcess = null;

  try {
    // 5. Start server using exact startCommand from render.yaml
    console.log(`[4/5] Starting server via startCommand (node scripts/start.mjs) on port ${TEST_PORT}...`);
    serverProcess = spawn(process.execPath, ['scripts/start.mjs'], {
      cwd: deployTestDir,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: {
        ...process.env,
        PORT: String(TEST_PORT),
        MONGODB_URL: testMongoUrl,
        JWT_SECRET: randomSecret,
        NODE_ENV: 'production',
        TRUST_PROXY: 'true',
        AVATAR_STORAGE: 'mongo',
        ALLOWED_ORIGINS: TEST_URL,
      },
    });

    serverProcess.stdout.on('data', (d) => {
      const msg = d.toString().trim();
      if (msg) console.log(`  [server] ${msg}`);
    });
    serverProcess.stderr.on('data', (d) => {
      const msg = d.toString().trim();
      if (msg) console.error(`  [server err] ${msg}`);
    });

    await waitForHealth(TEST_URL);
    console.log(`✓ Clean deployment server is HEALTHY at ${TEST_URL}/api/health\n`);

    // 6. Run production smoke check against the running server
    console.log('[5/5] Running production smoke check suite against clean deployment...');
    execSync(`node server/scripts/prod-smoke-check.mjs`, {
      cwd: deployTestDir,
      stdio: 'inherit',
      env: {
        ...process.env,
        TEST_BASE_URL: TEST_URL,
      },
    });
    console.log('\n✓ Production smoke check passed against clean build.\n');

  } finally {
    // Cleanup
    if (serverProcess) {
      console.log('Stopping clean deployment server...');
      stopChild(serverProcess);
    }
    await dropScratchDatabase(testDbName, testMongoUrl);

    console.log('Cleaning up deploy test directory...');
    fs.rmSync(deployTestDir, { recursive: true, force: true });
    console.log('✓ Removed deploy test directory.');
  }

  console.log('\n======================================================');
  console.log('CLEAN SCRATCH BUILD & DEPLOYMENT PROOF COMPLETE');
  console.log('Result: 100% PASSED');
  console.log('======================================================\n');
}

main().catch((err) => {
  console.error('Clean deployment proof failed:', err);
  process.exit(1);
});
