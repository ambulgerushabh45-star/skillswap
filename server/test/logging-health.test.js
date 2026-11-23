import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import http from 'node:http';
import { createApp } from '../src/app.js';
import {
  redactMongoUri,
  formatProcessErrorJson,
  buildProductionLogEntry,
} from '../src/middleware/logger.js';
import { signSessionToken } from '../src/lib/auth.js';
import { defaultStore } from '../src/lib/rate-limit.js';

describe('Part 2: Logging and Health', () => {
  describe('Credential Redaction Helper', () => {
    it('redacts credentials from standard mongodb:// URI', () => {
      const uri = 'mongodb://app_user:superSecret123@127.0.0.1:27018/skillswap?replicaSet=rs0';
      const redacted = redactMongoUri(uri);
      expect(redacted).toBe('mongodb://[REDACTED]@127.0.0.1:27018/skillswap?replicaSet=rs0');
      expect(redacted).not.toContain('superSecret123');
      expect(redacted).not.toContain('app_user');
    });

    it('redacts credentials from mongodb+srv:// URI with special characters', () => {
      const uri = 'mongodb+srv://admin:p%40ssw0rd!_123@cluster0.xyz.mongodb.net/skillswap?retryWrites=true';
      const redacted = redactMongoUri(uri);
      expect(redacted).toBe('mongodb+srv://[REDACTED]@cluster0.xyz.mongodb.net/skillswap?retryWrites=true');
      expect(redacted).not.toContain('p%40ssw0rd');
      expect(redacted).not.toContain('admin');
    });

    it('leaves uncredentialed URIs untouched', () => {
      const uri = 'mongodb://127.0.0.1:27018/skillswap?replicaSet=rs0';
      expect(redactMongoUri(uri)).toBe(uri);
    });

    it('redacts credentials inside stack traces and complex error messages', () => {
      const stack = 'MongoServerSelectionError: connect failed to mongodb://root:pw123@localhost:27018\n    at Connection.open';
      const redacted = redactMongoUri(stack);
      expect(redacted).toContain('mongodb://[REDACTED]@localhost:27018');
      expect(redacted).not.toContain('pw123');
    });

    it('gracefully handles non-string inputs', () => {
      expect(redactMongoUri(null)).toBe(null);
      expect(redactMongoUri(undefined)).toBe(undefined);
      expect(redactMongoUri(12345)).toBe(12345);
    });

    it('formats process error to valid JSON with redacted message and stack', () => {
      const error = new Error('Failed to connect to mongodb://user:pass@127.0.0.1:27018/db');
      const jsonStr = formatProcessErrorJson(error);
      const parsed = JSON.parse(jsonStr);
      expect(parsed.level).toBe('error');
      expect(parsed.timestamp).toBeTruthy();
      expect(parsed.message).toContain('mongodb://[REDACTED]@127.0.0.1:27018/db');
      expect(parsed.message).not.toContain('pass');
      expect(parsed.stack).toContain('mongodb://[REDACTED]@127.0.0.1:27018/db');
    });
  });

  describe('Production Request Log Entry Format', () => {
    it('produces JSON log entry without query string, cookies, headers, bodies, or IP', () => {
      const mockReq = {
        method: 'GET',
        originalUrl: '/api/users?search=john&sort=asc&apiKey=secret123',
        url: '/api/users?search=john&sort=asc&apiKey=secret123',
        headers: { authorization: 'Bearer token', cookie: 'skillswap_session=val' },
        body: { password: 'secret' },
        ip: '192.168.1.100',
        cookies: { skillswap_session: 'val' },
      };
      const mockRes = { statusCode: 200 };
      const start = Date.now() - 25;
      const requestId = '12345678-1234-4234-8234-123456789abc';

      const entry = buildProductionLogEntry({
        req: mockReq,
        res: mockRes,
        start,
        requestId,
      });

      expect(entry.requestId).toBe(requestId);
      expect(entry.method).toBe('GET');
      expect(entry.path).toBe('/api/users');
      expect(entry.status).toBe(200);
      expect(typeof entry.durationMs).toBe('number');
      expect(entry.durationMs).toBeGreaterThanOrEqual(0);

      // Verify strict privacy: forbidden fields must NOT be present
      const serialized = JSON.stringify(entry);
      expect(serialized).not.toContain('john');
      expect(serialized).not.toContain('secret123');
      expect(serialized).not.toContain('192.168.1.100');
      expect(serialized).not.toContain('Bearer');
      expect(entry.ip).toBeUndefined();
      expect(entry.headers).toBeUndefined();
      expect(entry.body).toBeUndefined();
      expect(entry.cookies).toBeUndefined();
    });

    it('includes userId in production log entry if logged in via req.user', () => {
      const mockReq = {
        method: 'POST',
        originalUrl: '/api/matches',
        user: { id: 'user-uuid-123' },
      };
      const mockRes = { statusCode: 201 };
      const entry = buildProductionLogEntry({
        req: mockReq,
        res: mockRes,
        start: Date.now(),
        requestId: 'req-1',
      });
      expect(entry.userId).toBe('user-uuid-123');
    });

    it('includes userId in production log entry if session cookie is present', () => {
      const token = signSessionToken('user-uuid-456');
      const mockReq = {
        method: 'GET',
        originalUrl: '/api/profile',
        cookies: { skillswap_session: token },
      };
      const mockRes = { statusCode: 200 };
      const entry = buildProductionLogEntry({
        req: mockReq,
        res: mockRes,
        start: Date.now(),
        requestId: 'req-2',
      });
      expect(entry.userId).toBe('user-uuid-456');
    });
  });

  describe('HTTP Endpoints & Headers', () => {
    let app;
    let server;
    let baseUrl;

    beforeAll(async () => {
      app = createApp({ isProduction: false });
      server = http.createServer(app);
      await new Promise((resolve) => server.listen(0, resolve));
      const port = server.address().port;
      baseUrl = `http://127.0.0.1:${port}`;
    });

    afterAll(async () => {
      await new Promise((resolve) => server.close(resolve));
    });

    it('returns an X-Request-Id UUID header on every response', async () => {
      const res = await fetch(`${baseUrl}/api/health`);
      expect(res.status).toBe(200);
      const requestId = res.headers.get('x-request-id');
      expect(requestId).toBeTruthy();
      expect(requestId).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
      );
    });

    it('GET /api/health remains unchanged and returns { status: "ok" }', async () => {
      const res = await fetch(`${baseUrl}/api/health`);
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toEqual({ status: 'ok' });
    });

    it('GET /api/health/db returns 200 { status: "ok" } when db ping succeeds', async () => {
      app.locals.dbPing = async () => ({ ok: 1 });
      const res = await fetch(`${baseUrl}/api/health/db`);
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toEqual({ status: 'ok' });
    });

    it('GET /api/health/db returns 503 { status: "unavailable" } when db ping fails', async () => {
      app.locals.dbPing = async () => {
        throw new Error('Database connection failed');
      };
      const res = await fetch(`${baseUrl}/api/health/db`);
      expect(res.status).toBe(503);
      const body = await res.json();
      expect(body).toEqual({ status: 'unavailable' });
    });

    it('GET /api/health/db returns 503 when ping hangs / times out', async () => {
      app.locals.dbPing = () => new Promise((_, reject) => {
        setTimeout(() => reject(new Error('DB ping timeout')), 50);
      });
      const res = await fetch(`${baseUrl}/api/health/db`);
      expect(res.status).toBe(503);
      const body = await res.json();
      expect(body).toEqual({ status: 'unavailable' });
      app.locals.dbPing = null;
    });

    it('GET /api/health/db enforces rate limit of 30 req/min/IP', async () => {
      defaultStore.reset();
      const prodApp = createApp({ isProduction: true });
      prodApp.locals.dbPing = async () => ({ ok: 1 });
      const prodServer = http.createServer(prodApp);
      await new Promise((resolve) => prodServer.listen(0, resolve));
      const pPort = prodServer.address().port;
      const pBase = `http://127.0.0.1:${pPort}`;

      try {
        for (let i = 0; i < 30; i++) {
          const res = await fetch(`${pBase}/api/health/db`);
          expect(res.status).toBe(200);
        }

        const blockedRes = await fetch(`${pBase}/api/health/db`);
        expect(blockedRes.status).toBe(429);
        const body = await blockedRes.json();
        expect(body.error).toBeTruthy();
      } finally {
        await new Promise((resolve) => prodServer.close(resolve));
        defaultStore.reset();
      }
    });
  });
});
