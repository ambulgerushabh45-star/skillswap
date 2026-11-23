import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  normalizeGeocodeQuery,
  parseNominatimResponse,
  GeocodeCache,
  NominatimThrottler,
  executeGeocodeSearch,
} from "../src/lib/geocode.js";

describe("normalizeGeocodeQuery", () => {
  it("trims leading and trailing whitespace", () => {
    expect(normalizeGeocodeQuery("  Cubbon Park  ")).toBe("cubbon park");
  });

  it("converts uppercase and mixed-case to lowercase", () => {
    expect(normalizeGeocodeQuery("BENGALURU, INDIA")).toBe("bengaluru, india");
    expect(normalizeGeocodeQuery("Koramangala 4th Block")).toBe("koramangala 4th block");
  });

  it("collapses multiple spaces, tabs, and newlines into single spaces", () => {
    expect(normalizeGeocodeQuery("Central   Library \t\n Cafe")).toBe("central library cafe");
  });
});

describe("parseNominatimResponse", () => {
  it("parses valid Nominatim items into GeocodeResult objects", () => {
    const raw = [
      {
        display_name: "Cubbon Park, Kasturba Road, Bengaluru, Karnataka, 560001, India",
        lat: "12.97631234",
        lon: "77.59298765",
      },
      {
        display_name: "Third Wave Coffee, Koramangala, Bengaluru, Karnataka, India",
        lat: "12.9352",
        lon: "77.6245",
      },
    ];

    const parsed = parseNominatimResponse(raw);
    expect(parsed).toHaveLength(2);
    expect(parsed[0]).toEqual({
      label: "Cubbon Park, Kasturba Road, Bengaluru, Karnataka, 560001, India",
      latitude: 12.976312,
      longitude: 77.592988,
    });
    expect(parsed[1]).toEqual({
      label: "Third Wave Coffee, Koramangala, Bengaluru, Karnataka, India",
      latitude: 12.9352,
      longitude: 77.6245,
    });
  });

  it("falls back to 'name' if 'display_name' is absent", () => {
    const raw = [{ name: "Central Park", lat: "40.785091", lon: "-73.968285" }];
    const parsed = parseNominatimResponse(raw);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].label).toBe("Central Park");
  });

  it("discards records with non-numeric, null, or out-of-range coordinates", () => {
    const raw = [
      { display_name: "Invalid Lat", lat: "not-a-number", lon: "77.59" },
      { display_name: "Out of bounds Lat", lat: "95.0", lon: "77.59" },
      { display_name: "Out of bounds Lon", lat: "12.97", lon: "185.0" },
      { display_name: "Missing Lon", lat: "12.97" },
      { display_name: "Valid Place", lat: "12.97", lon: "77.59" },
    ];

    const parsed = parseNominatimResponse(raw);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].label).toBe("Valid Place");
  });

  it("discards records missing a valid name/display_name", () => {
    const raw = [
      { display_name: "", lat: "12.97", lon: "77.59" },
      { display_name: "   ", lat: "12.97", lon: "77.59" },
      { lat: "12.97", lon: "77.59" },
      { display_name: 12345, lat: "12.97", lon: "77.59" },
      { display_name: "Valid Item", lat: "12.97", lon: "77.59" },
    ];

    const parsed = parseNominatimResponse(raw);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].label).toBe("Valid Item");
  });

  it("caps results to maxResults (default 5)", () => {
    const raw = Array.from({ length: 10 }, (_, i) => ({
      display_name: `Location ${i + 1}`,
      lat: String(12 + i * 0.01),
      lon: String(77 + i * 0.01),
    }));

    const parsed = parseNominatimResponse(raw, 5);
    expect(parsed).toHaveLength(5);
    expect(parsed[0].label).toBe("Location 1");
    expect(parsed[4].label).toBe("Location 5");
  });

  it("truncates excessively long labels to maxLabelLength (150 chars)", () => {
    const longName = "A".repeat(200);
    const raw = [{ display_name: longName, lat: "12.97", lon: "77.59" }];
    const parsed = parseNominatimResponse(raw, 5, 150);
    expect(parsed[0].label).toHaveLength(150);
  });

  it("returns empty array for non-array or empty raw inputs", () => {
    expect(parseNominatimResponse([])).toEqual([]);
    expect(parseNominatimResponse(null)).toEqual([]);
    expect(parseNominatimResponse(undefined)).toEqual([]);
    expect(parseNominatimResponse({ error: "Something went wrong" })).toEqual([]);
  });
});

describe("GeocodeCache", () => {
  let cache;

  beforeEach(() => {
    cache = new GeocodeCache(3);
    cache.clear();
  });

  it("stores and retrieves cached results", () => {
    const sample = [{ label: "Park", latitude: 12.0, longitude: 77.0 }];
    cache.set("park", sample, 10000, 1000);
    expect(cache.get("park", 1500)).toEqual(sample);
  });

  it("returns undefined for cache misses", () => {
    expect(cache.get("unknown", 1000)).toBeUndefined();
  });

  it("expires cached entries after TTL using custom clock", () => {
    const sample = [{ label: "Park", latitude: 12.0, longitude: 77.0 }];
    const now = 1000;
    const ttl = 5000;
    cache.set("park", sample, ttl, now);

    // Before expiry
    expect(cache.get("park", now + 4999)).toEqual(sample);
    // At expiry
    expect(cache.get("park", now + 5000)).toBeUndefined();
    // After expiry
    expect(cache.get("park", now + 6000)).toBeUndefined();
  });

  it("evicts oldest entry when size exceeds maxSize cap", () => {
    cache.set("first", [{ label: "1", latitude: 1, longitude: 1 }], 10000, 1000);
    cache.set("second", [{ label: "2", latitude: 2, longitude: 2 }], 10000, 1000);
    cache.set("third", [{ label: "3", latitude: 3, longitude: 3 }], 10000, 1000);

    expect(cache.size()).toBe(3);

    // Adding 4th item triggers eviction of oldest ("first")
    cache.set("fourth", [{ label: "4", latitude: 4, longitude: 4 }], 10000, 1000);
    expect(cache.size()).toBe(3);
    expect(cache.get("first", 1000)).toBeUndefined();
    expect(cache.get("second", 1000)).toBeDefined();
    expect(cache.get("third", 1000)).toBeDefined();
    expect(cache.get("fourth", 1000)).toBeDefined();
  });

  it("updates LRU order on access", () => {
    cache.set("first", [{ label: "1", latitude: 1, longitude: 1 }], 10000, 1000);
    cache.set("second", [{ label: "2", latitude: 2, longitude: 2 }], 10000, 1000);
    cache.set("third", [{ label: "3", latitude: 3, longitude: 3 }], 10000, 1000);

    // Access "first" so it becomes recently used
    cache.get("first", 1000);

    // Now adding 4th item evicts "second" instead of "first"
    cache.set("fourth", [{ label: "4", latitude: 4, longitude: 4 }], 10000, 1000);
    expect(cache.get("first", 1000)).toBeDefined();
    expect(cache.get("second", 1000)).toBeUndefined();
  });
});

describe("NominatimThrottler", () => {
  it("enforces at least 1000ms delay between consecutive executions", async () => {
    const throttler = new NominatimThrottler();
    throttler.reset();

    let fakeTime = 10000;
    const clock = () => fakeTime;
    const sleepCalls = [];
    const mockSleep = async (ms) => {
      sleepCalls.push(ms);
      fakeTime += ms;
    };

    // First request: no wait
    await throttler.throttle(clock, mockSleep);
    expect(sleepCalls).toHaveLength(0);
    expect(throttler.getLastRequestTime()).toBe(10000);

    // Second request: 200ms later -> must wait 800ms
    fakeTime = 10200;
    await throttler.throttle(clock, mockSleep);
    expect(sleepCalls).toEqual([800]);
    expect(throttler.getLastRequestTime()).toBe(11000);

    // Third request: 1500ms later -> no wait
    fakeTime = 12500;
    await throttler.throttle(clock, mockSleep);
    expect(sleepCalls).toEqual([800]); // No new sleep
    expect(throttler.getLastRequestTime()).toBe(12500);
  });
});

describe("executeGeocodeSearch", () => {
  it("returns cached result on subsequent calls without hitting upstream fetch", async () => {
    const cache = new GeocodeCache(10);
    cache.clear();
    const throttler = new NominatimThrottler();
    throttler.reset();

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => [
        {
          display_name: "Cubbon Park, Bengaluru",
          lat: "12.9763",
          lon: "77.5929",
        },
      ],
    });

    // 1st search: hits network
    const res1 = await executeGeocodeSearch("Cubbon Park", {
      cache,
      throttler,
      fetchFn: mockFetch,
      userAgent: "SkillSwapTest/1.0 (contact: test@example.com)",
      sleep: async () => {},
    });

    expect(res1.source).toBe("network");
    expect(res1.results).toHaveLength(1);
    expect(res1.results[0].label).toBe("Cubbon Park, Bengaluru");
    expect(mockFetch).toHaveBeenCalledTimes(1);

    // 2nd search with same query (different case/spaces): hits cache
    const res2 = await executeGeocodeSearch("  cubbon   park  ", {
      cache,
      throttler,
      fetchFn: mockFetch,
      sleep: async () => {},
    });

    expect(res2.source).toBe("cache");
    expect(res2.results).toEqual(res1.results);
    expect(mockFetch).toHaveBeenCalledTimes(1); // Not called again!
  });

  it("throws error when upstream Nominatim returns HTTP non-200", async () => {
    const cache = new GeocodeCache(10);
    const throttler = new NominatimThrottler();
    throttler.reset();

    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 429,
      json: async () => ({ error: "Too many requests" }),
    });

    await expect(
      executeGeocodeSearch("Central Library", {
        cache,
        throttler,
        fetchFn: mockFetch,
        sleep: async () => {},
      })
    ).rejects.toThrow("Nominatim upstream error: HTTP 429");
  });
});

