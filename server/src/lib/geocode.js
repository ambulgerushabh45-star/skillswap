// src/lib/geocode.js
// Pure parsing, normalization, caching and throttling helpers for OpenStreetMap Nominatim geocoding

/**
 * Normalizes a geocoding query by trimming, converting to lowercase,
 * and collapsing multiple consecutive whitespace characters into a single space.
 */
export function normalizeGeocodeQuery(query) {
  return query.trim().toLowerCase().replace(/\s+/g, " ");
}

/**
 * Safely parses an upstream Nominatim JSON response array.
 * Discards any records missing valid coordinates or names, clamps labels to maxLabelLength,
 * and caps the result list to maxResults.
 */
export function parseNominatimResponse(
  raw,
  maxResults = 5,
  maxLabelLength = 150
) {
  if (!Array.isArray(raw)) {
    return [];
  }

  const results = [];

  for (const item of raw) {
    if (!item || typeof item !== "object") continue;

    const rawName = item.display_name ?? item.name;
    if (typeof rawName !== "string" || !rawName.trim()) continue;

    const lat = parseFloat(String(item.lat));
    const lon = parseFloat(String(item.lon));

    if (!Number.isFinite(lat) || lat < -90 || lat > 90) continue;
    if (!Number.isFinite(lon) || lon < -180 || lon > 180) continue;

    let label = rawName.trim();
    if (label.length > maxLabelLength) {
      label = label.slice(0, maxLabelLength).trim();
    }

    results.push({
      label,
      latitude: Number(lat.toFixed(6)),
      longitude: Number(lon.toFixed(6)),
    });

    if (results.length >= maxResults) {
      break;
    }
  }

  return results;
}

/**
 * In-memory LRU-like cache for geocoding queries with a 24-hour TTL and hard size cap.
 * Stored on globalThis to persist across Next.js development hot-reloads.
 */
export class GeocodeCache {
  constructor(maxSize = 500) {
    this.maxSize = maxSize;
    const g = globalThis;
    if (!g.__geocodeCacheMap) {
      g.__geocodeCacheMap = new Map();
    }
    this.map = g.__geocodeCacheMap;
  }

  get(key, now = Date.now()) {
    const entry = this.map.get(key);
    if (!entry) return undefined;
    if (entry.expiresAt <= now) {
      this.map.delete(key);
      return undefined;
    }
    // Refresh insertion order on access for LRU
    this.map.delete(key);
    this.map.set(key, entry);
    return entry.results;
  }

  set(key, results, ttlMs = 86_400_000, now = Date.now()) {
    if (this.map.has(key)) {
      this.map.delete(key);
    } else if (this.map.size >= this.maxSize) {
      // Evict oldest entry (first key in insertion order)
      const oldestKey = this.map.keys().next().value;
      if (oldestKey !== undefined) {
        this.map.delete(oldestKey);
      }
    }

    this.map.set(key, {
      results,
      expiresAt: now + ttlMs,
    });
  }

  size() {
    return this.map.size;
  }

  clear() {
    this.map.clear();
  }
}

export const defaultGeocodeCache = new GeocodeCache();

/**
 * Global queue-based rate limiter enforcing Nominatim's 1-request-per-second policy.
 * Uses a serial promise chain to ensure concurrent requests wait their turn.
 */
export class NominatimThrottler {
  constructor() {
    const g = globalThis;
    if (!g.__nominatimThrottlerState) {
      g.__nominatimThrottlerState = { lastRequestTime: 0 };
    }
    this.lastRequestTime = g.__nominatimThrottlerState.lastRequestTime;
    this.queue = Promise.resolve();
  }

  async throttle(
    clock = () => Date.now(),
    sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
  ) {
    const nextInQueue = this.queue.then(async () => {
      const now = clock();
      const elapsed = now - this.lastRequestTime;
      if (elapsed < 1000) {
        const waitMs = 1000 - elapsed;
        await sleep(waitMs);
      }
      this.lastRequestTime = clock();
      const g = globalThis;
      if (g.__nominatimThrottlerState) {
        g.__nominatimThrottlerState.lastRequestTime = this.lastRequestTime;
      }
    });

    this.queue = nextInQueue.catch(() => {});
    return nextInQueue;
  }

  getLastRequestTime() {
    return this.lastRequestTime;
  }

  reset() {
    this.lastRequestTime = 0;
    this.queue = Promise.resolve();
  }
}

export const defaultNominatimThrottler = new NominatimThrottler();

/**
 * Executes an address search against Nominatim with normalization, cache lookup,
 * 1 req/sec throttle gate, and safe JSON parsing.
 */
export async function executeGeocodeSearch(
  query,
  options = {}
) {
  const normalized = normalizeGeocodeQuery(query);
  const cache = options.cache ?? defaultGeocodeCache;
  const throttler = options.throttler ?? defaultNominatimThrottler;
  const fetchFn = options.fetchFn ?? fetch;
  const clock = options.clock ?? (() => Date.now());
  const sleep = options.sleep;
  const timeoutMs = options.timeoutMs ?? 5000;
  const userAgent =
    options.userAgent ||
    process.env.NOMINATIM_USER_AGENT ||
    "SkillSwap/0.1 (contact: set-in-env)";

  // 1. Cache lookup
  const cached = cache.get(normalized, clock());
  if (cached !== undefined) {
    return { results: cached, source: "cache" };
  }

  // 2. Throttle (1 req/sec)
  await throttler.throttle(clock, sleep);

  // 3. Upstream Nominatim call
  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(
    normalized
  )}&format=jsonv2&limit=5&addressdetails=0`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  let response;
  try {
    response = await fetchFn(url, {
      method: "GET",
      headers: {
        "User-Agent": userAgent,
        Accept: "application/json",
      },
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeoutId);
  }

  if (!response.ok) {
    throw new Error(`Nominatim upstream error: HTTP ${response.status}`);
  }

  const rawJson = await response.json();
  const results = parseNominatimResponse(rawJson);

  // 4. Cache successful result (24h TTL)
  cache.set(normalized, results, 86_400_000, clock());

  return { results, source: "network" };
}

