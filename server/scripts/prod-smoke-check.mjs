// server/scripts/prod-smoke-check.mjs
// Production smoke verification script: launches Express with NODE_ENV=production on port 4000
// using an ephemeral in-memory JWT_SECRET, validates SPA serving, CSP, caching, auth/CSRF, avatars, and stops cleanly.

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn, spawnSync } from 'node:child_process';
import { PrismaClient } from '@prisma/client';
import { createScratchDatabase, dropScratchDatabase } from './test-db-helper.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const serverDir = path.resolve(__dirname, '..');
const clientDistDir = path.resolve(serverDir, '..', 'client', 'dist');

const PROD_URL = process.env.PROD_URL || process.env.TEST_BASE_URL;
const BASE_URL = PROD_URL ? PROD_URL.replace(/\/$/, '') : 'http://localhost:4000';
const isRemote = Boolean(PROD_URL);
let passed = 0;
let failed = 0;

function assert(condition, message, detail = '') {
  if (condition) {
    passed++;
    console.log(`  ✓ ${message}${detail ? ` (${detail})` : ''}`);
  } else {
    failed++;
    console.error(`  ✗ FAIL: ${message}${detail ? ` (${detail})` : ''}`);
  }
}

async function waitForHealth(url, timeoutMs = 15000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(`${url}/api/health`);
      if (res.ok) return true;
    } catch {
      // Server not listening yet
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error(`Timed out waiting for ${url}/api/health`);
}

function stopChild(child) {
  if (!child || child.exitCode !== null || child.killed) return;
  if (process.platform === 'win32') {
    spawnSync('taskkill', ['/PID', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
  } else {
    child.kill('SIGTERM');
  }
}

async function runProdSmoke() {
  console.log('======================================================');
  console.log(`Starting SkillSwap Production Mode Smoke Check (${BASE_URL})`);
  console.log('======================================================\n');

  let child = null;
  let testDbName = null;
  let testMongoUrl = null;
  let builtJsFile = null;

  if (!isRemote) {
    const distIndexPath = path.join(clientDistDir, 'index.html');
    assert(fs.existsSync(distIndexPath), 'client/dist/index.html exists before starting prod server');

    const assetsDir = path.join(clientDistDir, 'assets');
    builtJsFile = fs.readdirSync(assetsDir).find((f) => f.endsWith('.js'));
    assert(Boolean(builtJsFile), 'Built hashed JS asset exists in client/dist/assets', builtJsFile || 'none');

    console.log('Spinning up isolated scratch database for production smoke check...');
    const scratch = await createScratchDatabase({ loadData: true });
    testDbName = scratch.testDbName;
    testMongoUrl = scratch.testMongoUrl;

    const ephemeralJwtSecret = crypto.randomBytes(32).toString('hex');
    child = spawn(process.execPath, ['src/index.js'], {
      cwd: serverDir,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: {
        ...process.env,
        NODE_ENV: 'production',
        PORT: '4000',
        MONGODB_URL: testMongoUrl,
        JWT_SECRET: ephemeralJwtSecret,
        ALLOWED_ORIGINS: 'http://localhost:4000',
      },
    });

    await waitForHealth(BASE_URL);
    console.log('[1/5] Express server started in production mode on port 4000.\n');
  } else {
    console.log(`Testing against remote deployment: ${BASE_URL}\n`);
    await waitForHealth(BASE_URL);
  }

  try {
    // 1. HTML Shell & Security/CSP headers
    console.log('[2/5] Checking GET /, GET /dashboard, Cache-Control, and CSP headers...');
    const rootRes = await fetch(`${BASE_URL}/`, {
      headers: { Accept: 'text/html' },
    });
    assert(rootRes.status === 200, 'GET / returns status 200');
    assert(rootRes.headers.get('cache-control') === 'no-cache', `GET / Cache-Control is no-cache (${rootRes.headers.get('cache-control')})`);
    const rootHtml = await rootRes.text();
    assert(rootHtml.includes('<div id="root"'), 'GET / returns SPA HTML shell');

    const csp = rootRes.headers.get('content-security-policy') || '';
    assert(csp.includes("default-src 'self'"), "CSP includes default-src 'self'");
    assert(csp.includes("script-src 'self'"), "CSP includes script-src 'self'");
    assert(csp.includes("style-src 'self' 'unsafe-inline'"), "CSP includes style-src 'self' 'unsafe-inline'");
    assert(csp.includes("img-src 'self' data: blob: https:"), "CSP includes 'self' data: blob: https: img-src");
    assert(csp.includes("connect-src 'self'"), "CSP includes connect-src 'self'");
    assert(csp.includes("frame-ancestors 'none'"), "CSP includes frame-ancestors 'none'");
    assert(csp.includes("object-src 'none'"), "CSP includes object-src 'none'");
    assert(csp.includes("base-uri 'self'"), "CSP includes base-uri 'self'");
    assert(!csp.includes('upgrade-insecure-requests'), 'CSP omits upgrade-insecure-requests so local http://localhost:4000 loads clean');
    assert(rootRes.headers.get('x-content-type-options') === 'nosniff', 'X-Content-Type-Options is nosniff');
    assert(rootRes.headers.get('x-frame-options') === 'SAMEORIGIN', 'X-Frame-Options is SAMEORIGIN');

    const dashRes = await fetch(`${BASE_URL}/dashboard`, {
      headers: { Accept: 'text/html' },
    });
    assert(dashRes.status === 200, 'GET /dashboard returns status 200');
    assert(dashRes.headers.get('cache-control') === 'no-cache', 'GET /dashboard Cache-Control is no-cache');
    const dashHtml = await dashRes.text();
    assert(dashHtml.includes('<div id="root"'), 'GET /dashboard returns SPA HTML shell');

    // Extract built JS asset if not discovered from local filesystem
    if (!builtJsFile) {
      const match = rootHtml.match(/src="\/assets\/([^"]+\.js)"/);
      if (match) {
        builtJsFile = match[1];
      }
    }

    // 2. Built Asset Immutable Caching
    console.log('\n[3/5] Checking built JS asset immutable caching and traversal rejection...');
    if (builtJsFile) {
      const assetRes = await fetch(`${BASE_URL}/assets/${builtJsFile}`);
      assert(assetRes.status === 200, `GET /assets/${builtJsFile} returns status 200`);
      const assetCache = assetRes.headers.get('cache-control') || '';
      assert(
        assetCache.includes('immutable') && assetCache.includes('max-age=31536000'),
        `Asset has immutable long-term Cache-Control (${assetCache})`
      );
    } else {
      assert(false, 'Could not determine built JS asset filename');
    }

    const traversalRes = await fetch(`${BASE_URL}/..%2Fpackage.json`, {
      headers: { Accept: 'text/html' },
    });
    assert(traversalRes.status === 400, `Path traversal /..%2Fpackage.json rejected with 400 (got ${traversalRes.status})`);

    // 3. API Health & JSON 404
    console.log('\n[4/5] Checking /api/health and unknown /api JSON 404...');
    const healthRes = await fetch(`${BASE_URL}/api/health`);
    assert(healthRes.status === 200, 'GET /api/health returns 200');
    const healthData = await healthRes.json();
    assert(healthData.status === 'ok', 'GET /api/health returns { status: "ok" }');

    const unknownApiRes = await fetch(`${BASE_URL}/api/nonexistent-endpoint`, {
      headers: { Accept: 'text/html' },
    });
    assert(unknownApiRes.status === 404, 'Unknown /api path returns 404 even when Accept includes text/html');
    assert((unknownApiRes.headers.get('content-type') || '').includes('application/json'), 'Unknown /api 404 is JSON');

    // 4. Auth, Session, Foreign Origin CSRF, and Local Avatar under Production Env
    console.log('\n[5/5] Checking production Login, Session, CSRF 403, and Avatar Serving...');
    const allowedOrigin = isRemote ? BASE_URL : 'http://localhost:4000';
    const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Origin: allowedOrigin,
      },
      body: JSON.stringify({ email: 'alex@example.com', password: 'password123' }),
    });
    assert(loginRes.status === 200, `POST /api/auth/login with Origin ${allowedOrigin} returns 200`);
    const setCookie = loginRes.headers.get('set-cookie') || '';
    assert(setCookie.includes('skillswap_session='), 'Set-Cookie contains skillswap_session');
    assert(setCookie.includes('Secure'), 'Production session cookie includes Secure flag');
    const cookieMatch = setCookie.match(/skillswap_session=([^;]+)/);
    const cookieHeader = cookieMatch ? `skillswap_session=${cookieMatch[1]}` : '';

    const sessionRes = await fetch(`${BASE_URL}/api/auth/session`, {
      headers: { Cookie: cookieHeader },
    });
    assert(sessionRes.status === 200, 'GET /api/auth/session returns 200');
    const sessionData = await sessionRes.json();
    assert(sessionData.user?.email === 'alex@example.com', 'Authenticated session returns Alex Kumar');

    const foreignRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Origin: 'http://malicious-origin.example',
      },
      body: JSON.stringify({ email: 'alex@example.com', password: 'password123' }),
    });
    assert(foreignRes.status === 403, 'Foreign Origin request rejected with 403 Forbidden');

    if (sessionData.user?.image?.startsWith('/api/avatars/')) {
      const avatarRes = await fetch(`${BASE_URL}${sessionData.user.image}`, {
        headers: { Cookie: cookieHeader },
      });
      assert(avatarRes.status === 200, `Local avatar ${sessionData.user.image} serves cleanly with 200`);
      assert(avatarRes.headers.get('content-type') === 'image/webp', 'Avatar serves image/webp');
    }

    // Check DB row count unchanged if running locally
    if (testMongoUrl) {
      const testPrisma = new PrismaClient({ datasources: { db: { url: testMongoUrl } } });
      const userCount = await testPrisma.user.count();
      assert(userCount === 13, `Database User count intact (${userCount})`);
      await testPrisma.$disconnect();
    }
  } finally {
    stopChild(child);
    if (testDbName) {
      await dropScratchDatabase(testDbName, testMongoUrl);
    }
    console.log('\n[CLEANUP] Production server stopped and scratch database dropped cleanly.');
  }

  console.log('\n======================================================');
  console.log(`Production Smoke Check: ${passed} PASSED, ${failed} FAILED`);
  console.log('======================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runProdSmoke().catch((err) => {
  console.error('Production smoke check fatal error:', err);
  process.exit(1);
});

