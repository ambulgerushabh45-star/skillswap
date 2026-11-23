import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { createApp } from '../src/app.js';

describe('Production Static Serving & SPA Fallback', () => {
  let tmpDistDir;
  let server;
  let baseUrl;

  beforeAll(async () => {
    tmpDistDir = fs.mkdtempSync(path.join(os.tmpdir(), 'skillswap-dist-test-'));
    fs.mkdirSync(path.join(tmpDistDir, 'assets'), { recursive: true });
    fs.writeFileSync(
      path.join(tmpDistDir, 'index.html'),
      '<!DOCTYPE html><html><head><title>SkillSwap</title></head><body><div id="root"></div></body></html>'
    );
    fs.writeFileSync(
      path.join(tmpDistDir, 'assets', 'index-abc123.js'),
      'console.log("SkillSwap bundle");'
    );
    fs.writeFileSync(
      path.join(tmpDistDir, 'favicon.svg'),
      '<svg xmlns="http://www.w3.org/2000/svg"></svg>'
    );

    const TEST_PORT = 4300;
    const app = createApp({ isProduction: true, clientDistDir: tmpDistDir });
    await new Promise((resolve) => {
      server = app.listen(TEST_PORT, '127.0.0.1', () => {
        baseUrl = `http://127.0.0.1:${TEST_PORT}`;
        resolve();
      });
    });
  });

  afterAll(async () => {
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
    if (tmpDistDir && fs.existsSync(tmpDistDir)) {
      fs.rmSync(tmpDistDir, { recursive: true, force: true });
    }
  });

  it('serves index.html at GET / with no-cache and strict Helmet CSP headers', async () => {
    const res = await fetch(`${baseUrl}/`, {
      headers: { Accept: 'text/html' },
    });

    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/html');
    expect(res.headers.get('cache-control')).toBe('no-cache');
    expect(res.headers.get('x-content-type-options')).toBe('nosniff');

    const csp = res.headers.get('content-security-policy');
    expect(csp).toBeTruthy();
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("script-src 'self'");
    expect(csp).toContain("style-src 'self' 'unsafe-inline'");
    expect(csp).toContain("img-src 'self' data: blob: https:");
    expect(csp).toContain("connect-src 'self'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("base-uri 'self'");
    expect(csp).not.toContain('upgrade-insecure-requests');

    expect(res.headers.get('permissions-policy')).toBe('camera=(), microphone=(), geolocation=()');
    expect(res.headers.get('referrer-policy')).toBe('strict-origin-when-cross-origin');
    expect(res.headers.get('cross-origin-opener-policy')).toBe('same-origin');
    expect(res.headers.get('strict-transport-security')).toContain('max-age=31536000');
    expect(res.headers.get('x-powered-by')).toBeNull();

    const html = await res.text();
    expect(html).toContain('<div id="root"></div>');
  });

  it('serves SPA fallback HTML shell for deep links accepting HTML', async () => {
    const res = await fetch(`${baseUrl}/dashboard`, {
      headers: { Accept: 'text/html,application/xhtml+xml' },
    });

    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/html');
    expect(res.headers.get('cache-control')).toBe('no-cache');
    const html = await res.text();
    expect(html).toContain('<div id="root"></div>');
  });

  it('serves hashed assets under /assets with long-term immutable caching', async () => {
    const res = await fetch(`${baseUrl}/assets/index-abc123.js`);

    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toContain('immutable');
    expect(res.headers.get('cache-control')).toContain('max-age=31536000');
    const body = await res.text();
    expect(body).toContain('SkillSwap bundle');
  });

  it('returns JSON 404 for unknown /api paths even when Accept includes text/html', async () => {
    const res = await fetch(`${baseUrl}/api/does-not-exist`, {
      headers: { Accept: 'text/html' },
    });

    expect(res.status).toBe(404);
    expect(res.headers.get('content-type')).toContain('application/json');
    const body = await res.json();
    expect(body).toEqual({ error: 'Not found' });
  });

  it('returns 404 JSON for missing /assets files rather than SPA HTML shell', async () => {
    const res = await fetch(`${baseUrl}/assets/missing-chunk.js`, {
      headers: { Accept: 'text/html' },
    });

    expect(res.status).toBe(404);
    expect(res.headers.get('content-type')).toContain('application/json');
  });

  it('returns JSON 404 for non-API routes when client explicitly requests only application/json', async () => {
    const res = await fetch(`${baseUrl}/dashboard`, {
      headers: { Accept: 'application/json' },
    });

    expect(res.status).toBe(404);
    expect(res.headers.get('content-type')).toContain('application/json');
  });

  it('rejects paths containing encoded ".." traversal segments', async () => {
    const res1 = await fetch(`${baseUrl}/assets/..%2Findex.html`, {
      headers: { Accept: 'text/html' },
    });
    expect(res1.status).toBe(400);
    const body1 = await res1.json();
    expect(body1).toEqual({ error: 'Invalid path' });

    const res2 = await fetch(`${baseUrl}/..%2F..%2Fserver/package.json`, {
      headers: { Accept: 'text/html' },
    });
    expect(res2.status).toBe(400);
  });

  it('rejects unnormalized raw HTTP ".." traversal paths cleanly', async () => {
    const status = await new Promise((resolve, reject) => {
      const url = new URL(baseUrl);
      const req = http.request(
        {
          hostname: url.hostname,
          port: url.port,
          path: '/assets/../index.html',
          method: 'GET',
          headers: { Accept: 'text/html' },
        },
        (res) => {
          res.resume();
          resolve(res.statusCode);
        }
      );
      req.on('error', reject);
      req.end();
    });

    expect(status).toBe(400);
  });

  it('continues serving /api/health normally in production mode', async () => {
    const res = await fetch(`${baseUrl}/api/health`);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.status).toBe('ok');
  });
});

