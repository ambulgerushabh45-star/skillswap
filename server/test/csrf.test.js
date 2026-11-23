import { describe, it, expect, vi } from 'vitest';
import { csrfOriginCheck } from '../src/middleware/csrf.js';

describe('CSRF Origin Check Middleware', () => {
  function createMocks(method, origin) {
    const req = {
      method,
      headers: origin ? { origin } : {},
    };
    const res = {
      statusCode: 200,
      jsonBody: null,
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(body) {
        this.jsonBody = body;
        return this;
      },
    };
    const next = vi.fn();
    return { req, res, next };
  }

  it('allows safe methods (GET) even with foreign Origin', () => {
    const { req, res, next } = createMocks('GET', 'http://malicious-website.com');
    csrfOriginCheck(req, res, next);
    expect(next).toHaveBeenCalledTimes(1);
    expect(res.jsonBody).toBeNull();
  });

  it('allows state-changing methods without Origin header', () => {
    const { req, res, next } = createMocks('POST', undefined);
    csrfOriginCheck(req, res, next);
    expect(next).toHaveBeenCalledTimes(1);
    expect(res.jsonBody).toBeNull();
  });

  it('allows state-changing methods with trusted Origin (http://localhost:5173)', () => {
    const { req, res, next } = createMocks('POST', 'http://localhost:5173');
    csrfOriginCheck(req, res, next);
    expect(next).toHaveBeenCalledTimes(1);
    expect(res.jsonBody).toBeNull();
  });

  it('allows state-changing methods with trusted Origin (http://localhost:4000)', () => {
    const { req, res, next } = createMocks('PUT', 'http://localhost:4000');
    csrfOriginCheck(req, res, next);
    expect(next).toHaveBeenCalledTimes(1);
    expect(res.jsonBody).toBeNull();
  });

  it('blocks state-changing methods with foreign Origin with 403', () => {
    const { req, res, next } = createMocks('POST', 'http://attacker-site.com');
    csrfOriginCheck(req, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(403);
    expect(res.jsonBody).toEqual({ error: 'Invalid origin' });
  });

  it('blocks state-changing methods with trailing slash in origin when not allowed', () => {
    const { req, res, next } = createMocks('DELETE', 'http://evil.com/');
    csrfOriginCheck(req, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(403);
    expect(res.jsonBody).toEqual({ error: 'Invalid origin' });
  });

  it('blocks state-changing methods with Sec-Fetch-Site cross-site even without Origin', () => {
    const req = {
      method: 'POST',
      headers: { 'sec-fetch-site': 'cross-site' },
    };
    const res = {
      statusCode: 200,
      jsonBody: null,
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(body) {
        this.jsonBody = body;
        return this;
      },
    };
    const next = vi.fn();
    csrfOriginCheck(req, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(403);
    expect(res.jsonBody).toEqual({ error: 'Cross-site request blocked' });
  });

  it('allows state-changing methods with Sec-Fetch-Site same-origin', () => {
    const req = {
      method: 'POST',
      headers: { 'sec-fetch-site': 'same-origin' },
    };
    const res = {
      statusCode: 200,
      jsonBody: null,
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(body) {
        this.jsonBody = body;
        return this;
      },
    };
    const next = vi.fn();
    csrfOriginCheck(req, res, next);
    expect(next).toHaveBeenCalledTimes(1);
    expect(res.jsonBody).toBeNull();
  });
});
