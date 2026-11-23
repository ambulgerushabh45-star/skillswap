import { describe, it, expect } from "vitest";
import {
  buildRatingSummary,
  resolveViewerState,
  buildSafeProfileUser,
} from "../src/lib/profile-view.js";

describe("profile-view domain helpers", () => {
  describe("buildRatingSummary", () => {
    it("returns average null when review count is 0", () => {
      const result = buildRatingSummary(null, 0);
      expect(result).toEqual({ average: null, count: 0 });
    });

    it("returns average null when rawAvg is null even if count > 0", () => {
      const result = buildRatingSummary(null, 5);
      expect(result).toEqual({ average: null, count: 0 });
    });

    it("rounds average correctly to 1 decimal place for non-zero reviews", () => {
      const result = buildRatingSummary(4.6666666667, 3);
      expect(result).toEqual({ average: 4.7, count: 3 });
    });

    it("handles single perfect review", () => {
      const result = buildRatingSummary(5.0, 1);
      expect(result).toEqual({ average: 5.0, count: 1 });
    });
  });

  describe("resolveViewerState", () => {
    it("identifies self-view when viewerId matches targetUserId", () => {
      const result = resolveViewerState("user-1", "user-1", null, false);
      expect(result).toEqual({
        isSelf: true,
        matchStatus: "NONE",
        matchId: null,
        requestDirection: null,
        hasReviewed: false,
      });
    });

    it("returns NONE when no match exists", () => {
      const result = resolveViewerState("user-1", "user-2", null, false);
      expect(result).toEqual({
        isSelf: false,
        matchStatus: "NONE",
        matchId: null,
        requestDirection: null,
        hasReviewed: false,
      });
    });

    it("correctly maps matchStatus when viewer is userA and match is PENDING", () => {
      const result = resolveViewerState(
        "user-1",
        "user-2",
        { id: "match-123", status: "PENDING", userAId: "user-1", userBId: "user-2" },
        false
      );
      expect(result).toEqual({
        isSelf: false,
        matchStatus: "PENDING",
        matchId: "match-123",
        requestDirection: "SENT",
        hasReviewed: false,
      });
    });

    it("correctly maps matchStatus when viewer is userB (recipient) and match is PENDING", () => {
      const result = resolveViewerState(
        "user-2",
        "user-1",
        { id: "match-123", status: "PENDING", userAId: "user-1", userBId: "user-2" },
        false
      );
      expect(result).toEqual({
        isSelf: false,
        matchStatus: "PENDING",
        matchId: "match-123",
        requestDirection: "RECEIVED",
        hasReviewed: false,
      });
    });

    it("correctly maps matchStatus when viewer is userB and match is ACCEPTED", () => {
      const result = resolveViewerState(
        "user-2",
        "user-1",
        { id: "match-456", status: "ACCEPTED", userAId: "user-1", userBId: "user-2" },
        true
      );
      expect(result).toEqual({
        isSelf: false,
        matchStatus: "ACCEPTED",
        matchId: "match-456",
        requestDirection: null,
        hasReviewed: true,
      });
    });

    it("correctly maps DECLINED status", () => {
      const result = resolveViewerState(
        "user-1",
        "user-2",
        { id: "match-789", status: "DECLINED", userAId: "user-1", userBId: "user-2" },
        false
      );
      expect(result).toEqual({
        isSelf: false,
        matchStatus: "DECLINED",
        matchId: "match-789",
        requestDirection: null,
        hasReviewed: false,
      });
    });
  });

  describe("buildSafeProfileUser", () => {
    it("never includes email, passwordHash, latitude, or longitude", () => {
      // Intentionally passing raw DB object with sensitive fields to ensure strip behavior
      const rawUserWithSecrets = {
        id: "user-safe-id",
        name: "Test User",
        email: "private@example.com",
        passwordHash: "$2a$10$secretHashValueNeverExpose",
        lat: 12.9716,
        latitude: 12.9716,
        lng: 77.5946,
        longitude: 77.5946,
        bio: "Public bio text",
        location: "Koramangala, Bengaluru",
        avatarUrl: "https://example.com/avatar.jpg",
        skillsTeach: [
          {
            proficiency: "Expert",
            skill: { name: "TypeScript", category: "Programming" },
          },
        ],
        skillsLearn: [
          {
            skill: { name: "Guitar", category: "Music" },
          },
        ],
      };

      const safeUser = buildSafeProfileUser(rawUserWithSecrets);

      // Verify explicit keys
      expect(safeUser).toHaveProperty("id", "user-safe-id");
      expect(safeUser).toHaveProperty("name", "Test User");
      expect(safeUser).toHaveProperty("bio", "Public bio text");
      expect(safeUser).toHaveProperty("location", "Koramangala, Bengaluru");
      expect(safeUser.skillsTeach).toHaveLength(1);
      expect(safeUser.skillsTeach[0]).toEqual({
        name: "TypeScript",
        category: "Programming",
        proficiencyLevel: "Expert",
      });
      expect(safeUser.skillsLearn).toHaveLength(1);
      expect(safeUser.skillsLearn[0]).toEqual({
        name: "Guitar",
        category: "Music",
      });

      // Strict privacy assertions: verify forbidden keys are absent
      const stringified = JSON.stringify(safeUser);
      expect(stringified).not.toContain("private@example.com");
      expect(stringified).not.toContain("email");
      expect(stringified).not.toContain("passwordHash");
      expect(stringified).not.toContain("secretHashValue");
      expect(stringified).not.toContain("12.9716");
      expect(stringified).not.toContain("77.5946");
      expect(safeUser).not.toHaveProperty("email");
      expect(safeUser).not.toHaveProperty("passwordHash");
      expect(safeUser).not.toHaveProperty("lat");
      expect(safeUser).not.toHaveProperty("latitude");
      expect(safeUser).not.toHaveProperty("lng");
      expect(safeUser).not.toHaveProperty("longitude");
    });
  });
});

