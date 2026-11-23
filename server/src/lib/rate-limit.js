export class MemoryRateLimitStore {
  constructor() {
    const g = globalThis;
    if (!g.__rateLimitMap) {
      g.__rateLimitMap = new Map();
    }
    this.map = g.__rateLimitMap;
  }

  get(key) {
    return this.map.get(key);
  }

  increment(key, windowMs, now) {
    const existing = this.map.get(key);
    if (!existing || existing.expiresAt <= now) {
      const fresh = { count: 1, expiresAt: now + windowMs };
      this.map.set(key, fresh);
      return fresh;
    }
    existing.count += 1;
    return existing;
  }

  cleanup(now) {
    for (const [key, entry] of this.map.entries()) {
      if (entry.expiresAt <= now) {
        this.map.delete(key);
      }
    }
  }

  reset() {
    this.map.clear();
  }
}

export const defaultStore = new MemoryRateLimitStore();

/**
 * Returns true if rate limiting is disabled via RATE_LIMIT_DISABLED=true,
 * ONLY when NODE_ENV is not 'production'.
 * In production mode, this flag is strictly ignored.
 */
export function isRateLimitDisabled() {
  return process.env.NODE_ENV !== "production" && process.env.RATE_LIMIT_DISABLED === "true";
}

/**
 * Evaluates whether a request should be rate-limited under the given policy.
 * Supports an optional custom clock and custom store for deterministic unit testing.
 */
export function rateLimit(
  key,
  options,
  customClock,
  customStore
) {
  const { limit, windowSeconds } = options;

  if (isRateLimitDisabled()) {
    return {
      ok: true,
      limit,
      remaining: limit,
      retryAfterSeconds: 0,
    };
  }

  const now = customClock ? customClock() : Date.now();
  const store = customStore || defaultStore;
  const windowMs = windowSeconds * 1000;

  // Cleanup expired entries periodically (10% sampling to amortize overhead)
  if (Math.random() < 0.1) {
    store.cleanup(now);
  }

  const existing = store.get(key);
  if (!existing || existing.expiresAt <= now) {
    const fresh = store.increment(key, windowMs, now);
    return {
      ok: true,
      limit,
      remaining: Math.max(0, limit - fresh.count),
      retryAfterSeconds: 0,
    };
  }

  if (existing.count >= limit) {
    const retryAfterSeconds = Math.max(1, Math.ceil((existing.expiresAt - now) / 1000));
    return {
      ok: false,
      limit,
      remaining: 0,
      retryAfterSeconds,
    };
  }

  const updated = store.increment(key, windowMs, now);
  return {
    ok: true,
    limit,
    remaining: Math.max(0, limit - updated.count),
    retryAfterSeconds: 0,
  };
}

/**
 * Safely extracts client IP from request without manually trusting X-Forwarded-For.
 * Relies on Express req.ip (which only honors proxies if trust proxy is configured in app).
 */
export function getClientIp(req) {
  if (req && typeof req.ip === 'string' && req.ip) {
    return req.ip;
  }
  if (req && req.socket && typeof req.socket.remoteAddress === 'string') {
    return req.socket.remoteAddress;
  }
  return '127.0.0.1';
}

