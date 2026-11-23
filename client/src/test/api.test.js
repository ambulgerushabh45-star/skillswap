import { describe, it, expect, vi, beforeEach } from 'vitest';
import { apiFetch, ApiError } from '@/lib/api';

describe('apiFetch and ApiError', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('successfully returns parsed JSON data on 200 OK', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({ success: true, count: 42 }),
    });

    const res = await apiFetch('/api/test');
    expect(res).toEqual({ success: true, count: 42 });
    expect(fetch).toHaveBeenCalledWith('/api/test', expect.objectContaining({
      credentials: 'same-origin',
    }));
  });

  it('handles 204 No Content returning null', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 204,
      headers: new Headers(),
    });

    const res = await apiFetch('/api/test-empty');
    expect(res).toBeNull();
  });

  it('throws ApiError with server error message on 400 Bad Request', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      statusText: 'Bad Request',
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({ error: 'Invalid email address' }),
    });

    await expect(apiFetch('/api/test')).rejects.toThrow('Invalid email address');
  });

  it('extracts Retry-After header on 429 Too Many Requests', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 429,
      statusText: 'Too Many Requests',
      headers: new Headers({
        'content-type': 'application/json',
        'retry-after': '45',
      }),
      json: async () => ({ error: 'Too many requests. Please try again in 45 seconds.' }),
    });

    try {
      await apiFetch('/api/auth/login');
      expect.fail('Should have thrown an error');
    } catch (err) {
      expect(err).toBeInstanceOf(ApiError);
      expect(err.status).toBe(429);
      expect(err.retryAfter).toBe(45);
      expect(err.message).toContain('Too many requests');
    }
  });

  it('handles non-JSON error response gracefully', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 502,
      statusText: 'Bad Gateway',
      headers: new Headers({ 'content-type': 'text/html' }),
      text: async () => '<html>Bad Gateway</html>',
    });

    try {
      await apiFetch('/api/test');
      expect.fail('Should have thrown an error');
    } catch (err) {
      expect(err).toBeInstanceOf(ApiError);
      expect(err.status).toBe(502);
      expect(err.message).toBe('<html>Bad Gateway</html>');
    }
  });

  it('catches network disconnection and throws user-friendly message', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('Failed to fetch'));

    try {
      await apiFetch('/api/test');
      expect.fail('Should have thrown an error');
    } catch (err) {
      expect(err).toBeInstanceOf(ApiError);
      expect(err.status).toBe(0);
      expect(err.message).toContain('Cannot reach the server');
    }
  });
});

