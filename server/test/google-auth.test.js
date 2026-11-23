import { describe, it, beforeAll, afterAll, expect } from 'vitest';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
import {
  generatePkcePair,
  signOAuthStateToken,
  verifyOAuthStateToken,
  timingSafeStateCompare,
} from '../src/lib/oauth.js';
import config from '../src/config/env.js';
import {
  createScratchDatabase,
  dropScratchDatabase,
  stopTestServer,
  waitForServer,
} from '../scripts/test-db-helper.mjs';

describe('Part 4: Google OAuth 2.0 PKCE Flow', () => {
  describe('OAuth Helper Unit Tests', () => {
    it('generates a valid PKCE pair and state', () => {
      const { state, codeVerifier, codeChallenge } = generatePkcePair();
      expect(state).toBeTruthy();
      expect(codeVerifier).toBeTruthy();
      expect(codeChallenge).toBeTruthy();

      expect(typeof state).toBe('string');
      expect(typeof codeVerifier).toBe('string');
      expect(typeof codeChallenge).toBe('string');

      // Base64url character set check
      expect(codeVerifier).toMatch(/^[A-Za-z0-9_-]+$/);
      expect(codeChallenge).toMatch(/^[A-Za-z0-9_-]+$/);
    });

    it('signs and verifies state token correctly', () => {
      const pair = generatePkcePair();
      const token = signOAuthStateToken(pair);
      const decoded = verifyOAuthStateToken(token);

      expect(decoded).toBeTruthy();
      expect(decoded.state).toBe(pair.state);
      expect(decoded.codeVerifier).toBe(pair.codeVerifier);
    });

    it('rejects tampered or expired state token', () => {
      const pair = generatePkcePair();
      const expiredToken = jwt.sign(
        { state: pair.state, codeVerifier: pair.codeVerifier },
        config.JWT_SECRET,
        { algorithm: 'HS256', expiresIn: '-1s' }
      );
      expect(verifyOAuthStateToken(expiredToken)).toBeNull();

      const invalidToken = 'not.a.valid.jwt';
      expect(verifyOAuthStateToken(invalidToken)).toBeNull();
      expect(verifyOAuthStateToken(null)).toBeNull();
    });

    it('performs timing-safe string comparison', () => {
      const a = 'abc123stateValueXYZ';
      const b = 'abc123stateValueXYZ';
      const c = 'abc123stateValueDifferent';
      const d = 'short';

      expect(timingSafeStateCompare(a, b)).toBe(true);
      expect(timingSafeStateCompare(a, c)).toBe(false);
      expect(timingSafeStateCompare(a, d)).toBe(false);
      expect(timingSafeStateCompare(null, a)).toBe(false);
    });
  });

  describe('Scratch Integration Test with Local Mock Google Server', () => {
    let scratchDb;
    let prisma;
    let mockGoogleServer;
    let mockGoogleBase;
    let appServerProcess;
    const testPort = 4185;
    const appBaseUrl = `http://127.0.0.1:${testPort}`;

    // Mock Google response state
    let mockTokenResponse = { access_token: 'fake-access-token-123' };
    let mockTokenStatus = 200;
    let mockUserInfoResponse = {
      sub: 'google-sub-user-999',
      email: 'newgoogleuser@example.com',
      email_verified: true,
      name: 'Google User Name',
    };
    let mockUserInfoStatus = 200;

    beforeAll(async () => {
      // 1. Start mock Google server
      mockGoogleServer = http.createServer(async (req, res) => {
        const url = new URL(req.url, `http://${req.headers.host}`);

        if (url.pathname === '/token') {
          res.writeHead(mockTokenStatus, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(mockTokenResponse));
          return;
        }

        if (url.pathname === '/userinfo') {
          res.writeHead(mockUserInfoStatus, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(mockUserInfoResponse));
          return;
        }

        res.writeHead(404);
        res.end();
      });

      await new Promise((resolve) => mockGoogleServer.listen(0, resolve));
      mockGoogleBase = `http://127.0.0.1:${mockGoogleServer.address().port}`;

      // 2. Create scratch DB
      scratchDb = await createScratchDatabase({ loadData: true });
      prisma = new PrismaClient({
        datasources: { db: { url: scratchDb.testMongoUrl } },
      });

      // 3. Start test app server with Google credentials pointed to mock server
      const customEnv = {
        PORT: String(testPort),
        MONGODB_URL: scratchDb.testMongoUrl,
        NODE_ENV: 'test',
        PUBLIC_URL: appBaseUrl,
        GOOGLE_CLIENT_ID: 'mock-google-client-id.apps.googleusercontent.com',
        GOOGLE_CLIENT_SECRET: 'mock-google-client-secret-xyz',
        GOOGLE_AUTH_URL: `${mockGoogleBase}/auth`,
        GOOGLE_TOKEN_URL: `${mockGoogleBase}/token`,
        GOOGLE_USERINFO_URL: `${mockGoogleBase}/userinfo`,
      };

      const serverDir = path.resolve(__dirname, '..');
      const { spawn } = await import('node:child_process');
      appServerProcess = spawn('node', ['src/index.js'], {
        cwd: serverDir,
        env: {
          ...process.env,
          ...customEnv,
        },
        stdio: 'pipe',
      });

      await waitForServer(appBaseUrl, 15000);
    }, 45000);

    afterAll(async () => {
      if (appServerProcess) {
        stopTestServer(appServerProcess);
      }
      if (mockGoogleServer) {
        await new Promise((resolve) => mockGoogleServer.close(resolve));
      }
      if (prisma) {
        await prisma.$disconnect();
      }
      if (scratchDb?.testDbName) {
        await dropScratchDatabase(scratchDb.testDbName, scratchDb.testMongoUrl);
      }
    });

    it('GET /api/auth/providers returns { google: true } when configured', async () => {
      const res = await fetch(`${appBaseUrl}/api/auth/providers`);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data).toEqual({ google: true });
    });

    it('GET /api/auth/google redirects to Google and sets skillswap_oauth cookie', async () => {
      const res = await fetch(`${appBaseUrl}/api/auth/google`, {
        redirect: 'manual',
      });
      expect(res.status).toBe(302);
      const location = res.headers.get('location');
      expect(location).toBeTruthy();
      expect(location).toContain(`${mockGoogleBase}/auth`);
      expect(location).toContain('response_type=code');
      expect(location).toContain('code_challenge=');

      const cookieHeader = res.headers.get('set-cookie');
      expect(cookieHeader).toBeTruthy();
      expect(cookieHeader).toContain('skillswap_oauth=');
      expect(cookieHeader).toContain('Path=/api/auth/google');
    });

    it('GET /api/auth/google/callback handles user cancellation', async () => {
      const res = await fetch(`${appBaseUrl}/api/auth/google/callback?error=access_denied`, {
        redirect: 'manual',
      });
      expect(res.status).toBe(302);
      expect(res.headers.get('location')).toBe('/auth?error=google_cancelled');

      // Verifies cookie is cleared
      const cookieHeader = res.headers.get('set-cookie');
      expect(cookieHeader).toContain('skillswap_oauth=;');
    });

    it('GET /api/auth/google/callback fails if cookie is missing or state does not match', async () => {
      // 1. Missing cookie
      const resMissing = await fetch(
        `${appBaseUrl}/api/auth/google/callback?code=mock_code&state=fake_state`,
        { redirect: 'manual' }
      );
      expect(resMissing.status).toBe(302);
      expect(resMissing.headers.get('location')).toBe('/auth?error=google_failed');

      // 2. Cookie state mismatch
      const stateToken = signOAuthStateToken({
        state: 'correct_state',
        codeVerifier: 'verifier123',
      });
      const resMismatch = await fetch(
        `${appBaseUrl}/api/auth/google/callback?code=mock_code&state=wrong_state`,
        {
          headers: { Cookie: `skillswap_oauth=${stateToken}` },
          redirect: 'manual',
        }
      );
      expect(resMismatch.status).toBe(302);
      expect(resMismatch.headers.get('location')).toBe('/auth?error=google_failed');
    });

    it('creates new user + OAuthAccount and redirects to /profile/setup on first login', async () => {
      const state = 'signup_state_123';
      const codeVerifier = 'verifier_signup_123';
      const stateToken = signOAuthStateToken({ state, codeVerifier });

      const email = `google-new-${Date.now()}@example.com`;
      const sub = `sub-${Date.now()}`;
      mockUserInfoResponse = {
        sub,
        email,
        email_verified: true,
        name: 'New Google User',
      };

      const res = await fetch(
        `${appBaseUrl}/api/auth/google/callback?code=valid_code&state=${state}`,
        {
          headers: { Cookie: `skillswap_oauth=${stateToken}` },
          redirect: 'manual',
        }
      );

      expect(res.status).toBe(302);
      expect(res.headers.get('location')).toBe('/profile/setup');

      // Verify session cookie was set
      const cookie = res.headers.get('set-cookie');
      expect(cookie).toContain('skillswap_session=');

      // Verify user and OAuthAccount were created in DB
      const user = await prisma.user.findUnique({
        where: { email },
        include: { oauthAccounts: true },
      });
      expect(user).not.toBeNull();
      expect(user.name).toBe('New Google User');
      expect(user.oauthAccounts.length).toBe(1);
      expect(user.oauthAccounts[0].provider).toBe('google');
      expect(user.oauthAccounts[0].providerAccountId).toBe(sub);

      // Verify second login with same google sub logs in without creating duplicate and redirects to /dashboard
      const returningStateToken = signOAuthStateToken({
        state: 'return_state',
        codeVerifier: 'verifier_return',
      });
      const returningRes = await fetch(
        `${appBaseUrl}/api/auth/google/callback?code=valid_code&state=return_state`,
        {
          headers: { Cookie: `skillswap_oauth=${returningStateToken}` },
          redirect: 'manual',
        }
      );

      expect(returningRes.status).toBe(302);
      expect(returningRes.headers.get('location')).toBe('/dashboard');

      const userCount = await prisma.user.count({ where: { email } });
      expect(userCount).toBe(1);
    });

    it('rejects login if email already exists as a password account (anti-pre-hijacking)', async () => {
      const passwordHash = await bcrypt.hash('Secret123!', 10);
      const existingEmail = `existing-password-${Date.now()}@example.com`;

      // Create pre-existing local password user
      await prisma.user.create({
        data: {
          name: 'Existing Password User',
          email: existingEmail,
          passwordHash,
        },
      });

      const state = 'hijack_state';
      const stateToken = signOAuthStateToken({
        state,
        codeVerifier: 'verifier_hijack',
      });

      // Google returns the same email but a new sub
      mockUserInfoResponse = {
        sub: `sub-unlinked-${Date.now()}`,
        email: existingEmail,
        email_verified: true,
        name: 'Attacker Name',
      };

      const res = await fetch(
        `${appBaseUrl}/api/auth/google/callback?code=valid_code&state=${state}`,
        {
          headers: { Cookie: `skillswap_oauth=${stateToken}` },
          redirect: 'manual',
        }
      );

      expect(res.status).toBe(302);
      expect(res.headers.get('location')).toBe('/auth?error=account_exists');

      // Verify NO session cookie was granted
      const cookie = res.headers.get('set-cookie');
      expect(cookie).not.toContain('skillswap_session=');

      // Verify OAuthAccount was NOT linked
      const checkUser = await prisma.user.findUnique({
        where: { email: existingEmail },
        include: { oauthAccounts: true },
      });
      expect(checkUser.oauthAccounts.length).toBe(0);
    });

    it('rejects callback if email_verified is false', async () => {
      const state = 'unverified_state';
      const stateToken = signOAuthStateToken({
        state,
        codeVerifier: 'verifier_unverified',
      });

      mockUserInfoResponse = {
        sub: 'unverified-sub',
        email: `unverified-${Date.now()}@example.com`,
        email_verified: false,
        name: 'Unverified User',
      };

      const res = await fetch(
        `${appBaseUrl}/api/auth/google/callback?code=valid_code&state=${state}`,
        {
          headers: { Cookie: `skillswap_oauth=${stateToken}` },
          redirect: 'manual',
        }
      );

      expect(res.status).toBe(302);
      expect(res.headers.get('location')).toBe('/auth?error=google_failed');
    });

    it('handles Google token endpoint 500 error gracefully', async () => {
      const state = 'token_fail_state';
      const stateToken = signOAuthStateToken({
        state,
        codeVerifier: 'verifier_token_fail',
      });

      mockTokenStatus = 500;
      mockTokenResponse = { error: 'internal_server_error' };

      const res = await fetch(
        `${appBaseUrl}/api/auth/google/callback?code=fail_code&state=${state}`,
        {
          headers: { Cookie: `skillswap_oauth=${stateToken}` },
          redirect: 'manual',
        }
      );

      expect(res.status).toBe(302);
      expect(res.headers.get('location')).toBe('/auth?error=google_failed');

      // Reset mock token status
      mockTokenStatus = 200;
      mockTokenResponse = { access_token: 'fake-access-token-123' };
    });
  });
});
