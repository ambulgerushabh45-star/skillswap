import { describe, it, expect } from "vitest";
import {
  haversineKm,
  roundKm,
  formatDistance,
  isValidCoordinate,
  EARTH_RADIUS_KM,
} from "../src/lib/geo.js";

describe("isValidCoordinate", () => {
  it("accepts valid coordinates within geographic ranges", () => {
    expect(isValidCoordinate(0, 0)).toBe(true);
    expect(isValidCoordinate(12.9716, 77.5946)).toBe(true);
    expect(isValidCoordinate(-90, -180)).toBe(true);
    expect(isValidCoordinate(90, 180)).toBe(true);
  });

  it("rejects non-numeric, NaN, infinite, or out-of-bounds coordinates", () => {
    expect(isValidCoordinate(null, 77)).toBe(false);
    expect(isValidCoordinate(12, undefined)).toBe(false);
    expect(isValidCoordinate("12", 77)).toBe(false);
    expect(isValidCoordinate(NaN, 77)).toBe(false);
    expect(isValidCoordinate(Infinity, 77)).toBe(false);
    expect(isValidCoordinate(90.1, 77)).toBe(false);
    expect(isValidCoordinate(-90.1, 77)).toBe(false);
    expect(isValidCoordinate(12, 180.1)).toBe(false);
    expect(isValidCoordinate(12, -180.1)).toBe(false);
  });
});

describe("haversineKm", () => {
  it("returns 0 for identical coordinates", () => {
    const dist = haversineKm(12.9716, 77.5946, 12.9716, 77.5946);
    expect(dist).toBe(0);
  });

  it("calculates accurate distance between known Indian landmarks (Bengaluru to Mumbai)", () => {
    // Cubbon Park, Bengaluru: 12.9763, 77.5929
    // Bandra West, Mumbai: 19.0596, 72.8295
    const dist = haversineKm(12.9763, 77.5929, 19.0596, 72.8295);
    expect(dist).not.toBeNull();
    // Expected distance is approximately 840 km (~842 km)
    expect(dist).toBeGreaterThan(830);
    expect(dist).toBeLessThan(855);
  });

  it("is symmetric regardless of point order", () => {
    const d1 = haversineKm(12.9763, 77.5929, 19.0596, 72.8295);
    const d2 = haversineKm(19.0596, 72.8295, 12.9763, 77.5929);
    expect(d1).toBeCloseTo(d2, 6);
  });

  it("calculates antipodal points to approximately half Earth circumference", () => {
    // North Pole to South Pole: pi * R ~ 20015 km
    const dist = haversineKm(90, 0, -90, 0);
    expect(dist).not.toBeNull();
    expect(dist).toBeCloseTo(Math.PI * EARTH_RADIUS_KM, 0);
  });

  it("returns null for invalid inputs", () => {
    expect(haversineKm(null, 77, 12, 77)).toBeNull();
    expect(haversineKm(12, undefined, 12, 77)).toBeNull();
    expect(haversineKm(95, 77, 12, 77)).toBeNull();
    expect(haversineKm(12, 77, 12, 200)).toBeNull();
    expect(haversineKm("12", "77", 12, 77)).toBeNull();
  });
});

describe("roundKm", () => {
  it("rounds whole kilometres accurately (step = 1)", () => {
    expect(roundKm(0.49, 1)).toBe(0);
    expect(roundKm(0.5, 1)).toBe(1);
    expect(roundKm(1.4, 1)).toBe(1);
    expect(roundKm(1.5, 1)).toBe(2);
    expect(roundKm(3.49, 1)).toBe(3);
    expect(roundKm(3.5, 1)).toBe(4);
  });

  it("rounds tenths of a kilometre accurately (step = 0.1)", () => {
    expect(roundKm(1.4, 0.1)).toBe(1.4);
    expect(roundKm(1.44, 0.1)).toBe(1.4);
    expect(roundKm(1.46, 0.1)).toBe(1.5);
    expect(roundKm(2.32, 0.1)).toBe(2.3);
  });

  it("handles 0 and negative numbers safely", () => {
    expect(roundKm(0, 1)).toBe(0);
    expect(roundKm(-5, 1)).toBe(0);
  });
});

describe("formatDistance", () => {
  it("returns null when input is null or undefined", () => {
    expect(formatDistance(null)).toBeNull();
    expect(formatDistance(undefined)).toBeNull();
  });

  it("formats sub-kilometre distances as 'Less than 1 km away'", () => {
    expect(formatDistance(0)).toBe("Less than 1 km away");
    expect(formatDistance(0.4)).toBe("Less than 1 km away");
    expect(formatDistance(0.8)).toBe("Less than 1 km away");
  });

  it("formats whole kilometre distances as 'X km away'", () => {
    expect(formatDistance(1)).toBe("1 km away");
    expect(formatDistance(3)).toBe("3 km away");
    expect(formatDistance(25)).toBe("25 km away");
  });

  it("formats decimal event distances as 'X.Y km away'", () => {
    expect(formatDistance(2.3)).toBe("2.3 km away");
    expect(formatDistance(15.7)).toBe("15.7 km away");
  });
});

