import { describe, it, expect } from 'vitest';
import jwt from 'jsonwebtoken';
import {
  signSessionToken,
  verifySessionToken,
  getSessionCookieOptions,
  COOKIE_NAME,
  DUMMY_PASSWORD_HASH,
} from '../src/lib/auth.js';
import config from '../src/config/env.js';

describe('Auth & JWT Tests', () => {
  it('signs and verifies a valid token successfully', () => {
    const userId = 'user-uuid-1234';
    const token = signSessionToken(userId);
    expect(typeof token).toBe('string');

    const decoded = verifySessionToken(token);
    expect(decoded).not.toBeNull();
    expect(decoded.sub).toBe(userId);
  });

  it('rejects expired tokens', () => {
    const expiredToken = signSessionToken('user-123', { expiresIn: '-1s' });
    const result = verifySessionToken(expiredToken);
    expect(result).toBeNull();
  });

  it('rejects tampered tokens', () => {
    const token = signSessionToken('user-123');
    const parts = token.split('.');
    // Tamper with the signature part
    const tampered = `${parts[0]}.${parts[1]}.tamperedSignature123`;
    const result = verifySessionToken(tampered);
    expect(result).toBeNull();
  });

  it('rejects tokens signed with a different secret', () => {
    const forgedToken = jwt.sign({ sub: 'user-hacker' }, 'a-completely-different-secret-key-32chars', {
      algorithm: 'HS256',
    });
    const result = verifySessionToken(forgedToken);
    expect(result).toBeNull();
  });

  it('strictly rejects the "none" algorithm', () => {
    // Generate an unsigned token using algorithm none
    const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
    const payload = Buffer.from(JSON.stringify({ sub: 'user-none-attack' })).toString('base64url');
    const noneToken = `${header}.${payload}.`;

    const result = verifySessionToken(noneToken);
    expect(result).toBeNull();
  });

  it('provides correct cookie options for development/test environment', () => {
    const opts = getSessionCookieOptions();
    expect(opts.httpOnly).toBe(true);
    expect(opts.sameSite).toBe('lax');
    expect(opts.path).toBe('/');
    expect(opts.maxAge).toBe(7 * 24 * 60 * 60 * 1000);
    // In dev / test, secure is false
    expect(opts.secure).toBe(config.IS_PRODUCTION);
  });

  it('defines a valid bcrypt dummy password hash', () => {
    expect(COOKIE_NAME).toBe('skillswap_session');
    expect(DUMMY_PASSWORD_HASH).toMatch(/^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}$/);
  });
});

