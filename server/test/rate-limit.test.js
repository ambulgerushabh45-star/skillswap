import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  rateLimit,
  isRateLimitDisabled,
  getClientIp,
  MemoryRateLimitStore,
} from "../src/lib/rate-limit.js";

describe("src/lib/rate-limit.js Unit Tests", () => {
  let mockTime = 1_000_000;
  const fakeClock = () => mockTime;
  let testStore;

  beforeEach(() => {
    mockTime = 1_000_000;
    testStore = new MemoryRateLimitStore();
    testStore.reset();
    delete process.env.RATE_LIMIT_DISABLED;
  });

  afterEach(() => {
    delete process.env.RATE_LIMIT_DISABLED;
  });

  it("allows up to the limit and computes remaining count", () => {
    const key = "user-123";
    const options = { limit: 3, windowSeconds: 60 };

    const r1 = rateLimit(key, options, fakeClock, testStore);
    expect(r1.ok).toBe(true);
    expect(r1.remaining).toBe(2);
    expect(r1.retryAfterSeconds).toBe(0);

    const r2 = rateLimit(key, options, fakeClock, testStore);
    expect(r2.ok).toBe(true);
    expect(r2.remaining).toBe(1);

    const r3 = rateLimit(key, options, fakeClock, testStore);
    expect(r3.ok).toBe(true);
    expect(r3.remaining).toBe(0);
  });

  it("blocks requests once the limit is exceeded and returns retryAfter", () => {
    const key = "user-456";
    const options = { limit: 2, windowSeconds: 60 };

    rateLimit(key, options, fakeClock, testStore);
    rateLimit(key, options, fakeClock, testStore);

    // Exceeded
    const blocked = rateLimit(key, options, fakeClock, testStore);
    expect(blocked.ok).toBe(false);
    expect(blocked.remaining).toBe(0);
    expect(blocked.retryAfterSeconds).toBe(60);

    // Advance clock by 25 seconds
    mockTime += 25_000;
    const stillBlocked = rateLimit(key, options, fakeClock, testStore);
    expect(stillBlocked.ok).toBe(false);
    expect(stillBlocked.retryAfterSeconds).toBe(35);
  });

  it("resets counters after the window duration has elapsed", () => {
    const key = "user-789";
    const options = { limit: 2, windowSeconds: 30 };

    rateLimit(key, options, fakeClock, testStore);
    rateLimit(key, options, fakeClock, testStore);

    const blocked = rateLimit(key, options, fakeClock, testStore);
    expect(blocked.ok).toBe(false);

    // Fast-forward 31 seconds (past window)
    mockTime += 31_000;

    const allowedAgain = rateLimit(key, options, fakeClock, testStore);
    expect(allowedAgain.ok).toBe(true);
    expect(allowedAgain.remaining).toBe(1);
  });

  it("isolates counters across different keys", () => {
    const options = { limit: 1, windowSeconds: 60 };

    const userA = rateLimit("user-a", options, fakeClock, testStore);
    expect(userA.ok).toBe(true);

    const userABlocked = rateLimit("user-a", options, fakeClock, testStore);
    expect(userABlocked.ok).toBe(false);

    // userB should be unaffected
    const userB = rateLimit("user-b", options, fakeClock, testStore);
    expect(userB.ok).toBe(true);
    expect(userB.remaining).toBe(0);
  });

  it("cleanup removes expired entries from store", () => {
    const options = { limit: 5, windowSeconds: 10 };
    rateLimit("temp-key", options, fakeClock, testStore);

    expect(testStore.get("temp-key")).toBeDefined();

    // Advance clock past expiration
    mockTime += 15_000;
    testStore.cleanup(mockTime);

    expect(testStore.get("temp-key")).toBeUndefined();
  });

  it("strictly enforces rate limits in production even if RATE_LIMIT_DISABLED is true", () => {
    try {
      // In production
      vi.stubEnv("NODE_ENV", "production");
      process.env.RATE_LIMIT_DISABLED = "true";

      expect(isRateLimitDisabled()).toBe(false);

      const options = { limit: 1, windowSeconds: 60 };
      const r1 = rateLimit("prod-key", options, fakeClock, testStore);
      expect(r1.ok).toBe(true);

      const r2 = rateLimit("prod-key", options, fakeClock, testStore);
      expect(r2.ok).toBe(false);
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it("allows bypass when RATE_LIMIT_DISABLED is true in non-production", () => {
    try {
      vi.stubEnv("NODE_ENV", "test");
      process.env.RATE_LIMIT_DISABLED = "true";

      expect(isRateLimitDisabled()).toBe(true);

      const options = { limit: 1, windowSeconds: 60 };
      const r1 = rateLimit("bypass-key", options, fakeClock, testStore);
      expect(r1.ok).toBe(true);

      const r2 = rateLimit("bypass-key", options, fakeClock, testStore);
      expect(r2.ok).toBe(true);
      expect(r2.remaining).toBe(1);
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it("getClientIp uses req.ip or req.socket and ignores untrusted manual headers", () => {
    // 1. Express req with req.ip
    const req1 = { ip: "203.0.113.195", headers: { "x-forwarded-for": "10.0.0.1" } };
    expect(getClientIp(req1)).toBe("203.0.113.195");

    // 2. Fallback to socket remoteAddress
    const req2 = { socket: { remoteAddress: "198.51.100.42" } };
    expect(getClientIp(req2)).toBe("198.51.100.42");

    // 3. Fallback when missing
    const req3 = {};
    expect(getClientIp(req3)).toBe("127.0.0.1");
  });
});

