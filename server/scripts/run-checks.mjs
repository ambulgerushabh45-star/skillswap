// server/scripts/run-checks.mjs
// Runs Express API verification scripts sequentially against an isolated scratch MongoDB database.
// Guarantees zero writes or leaks into the main database or external project databases.

import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  createScratchDatabase,
  dropScratchDatabase,
  startTestServer,
  stopTestServer,
  waitForServer,
} from './test-db-helper.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const READ_ONLY_SCRIPTS = [
  'security-check.mjs',
  'validation-check.mjs',
  'pagination-check.mjs',
  'review-check.mjs',
  'profile-check.mjs',
  'geocode-check.mjs',
  'distance-check.mjs',
  'avatar-check.mjs',
  'p35-check.mjs',
  'security2-check.mjs',
];

const TEST_PORT = 4000;
const TEST_BASE_URL = `http://localhost:${TEST_PORT}`;

async function main() {
  console.log('======================================================');
  console.log('SkillSwap Full Test Suite (MongoDB)');
  console.log('======================================================\n');

  console.log('[1/3] Spinning up scratch database for read-only checks...');
  const { testDbName, testMongoUrl } = await createScratchDatabase({ loadData: true });

  console.log(`[2/3] Starting Express test server on port ${TEST_PORT}...`);
  const serverProcess = startTestServer({
    port: TEST_PORT,
    mongoUrl: testMongoUrl,
  });

  try {
    await waitForServer(TEST_BASE_URL);
    console.log(`Test server listening at ${TEST_BASE_URL}\n`);

    for (const script of READ_ONLY_SCRIPTS) {
      const fullPath = path.join(__dirname, script);
      console.log(`\n>>> Running ${script}...`);
      const result = spawnSync(process.execPath, [fullPath], {
        stdio: 'inherit',
        env: {
          ...process.env,
          PORT: String(TEST_PORT),
          MONGODB_URL: testMongoUrl,
          TEST_BASE_URL,
        },
      });

      if (result.status !== 0) {
        console.error(`\n[ERROR] Check script ${script} failed with exit code ${result.status}`);
        process.exit(result.status ?? 1);
      }
    }
  } finally {
    console.log('\nStopping read-only test server...');
    stopTestServer(serverProcess);
    await dropScratchDatabase(testDbName, testMongoUrl);
  }

  console.log('\n[3/3] Running P3.5 Write-Path & Concurrency Integration Test...');
  const writeCheckPath = path.join(__dirname, 'p35-write-check.mjs');
  const writeResult = spawnSync(process.execPath, [writeCheckPath], {
    stdio: 'inherit',
    env: process.env,
  });

  if (writeResult.status !== 0) {
    console.error(`\n[ERROR] Check script p35-write-check.mjs failed with exit code ${writeResult.status}`);
    process.exit(writeResult.status ?? 1);
  }

  console.log('\n======================================================');
  console.log('[SUCCESS] All server check scripts passed.');
  console.log('======================================================');
}

main().catch((err) => {
  console.error('\nFatal error running checks:', err);
  process.exit(1);
});
