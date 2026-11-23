import { describe, it, expect } from "vitest";
import {
  calculateRating,
  determineMatchedSkillName,
  findConnectionStatus,
  determineRequestDirection,
  computePeerMatch,
  computeAllMatches,
} from "../src/lib/matching.js";

describe("Matching Engine Unit Tests", () => {
  // Test fixture helpers
  const createMockUser = (overrides) => ({
    id: "user-current",
    name: "Alex",
    email: "alex@example.com",
    location: "Bengaluru",
    skillsTeach: [
      { skill: { id: "skill-1", name: "JavaScript / React" }, proficiency: "Advanced" },
    ],
    skillsLearn: [
      { skill: { id: "skill-2", name: "Acoustic Guitar" } },
    ],
    ...overrides,
  });

  const createMockPeer = (overrides) => ({
    id: "peer-1",
    name: "Priya",
    email: "priya@example.com",
    bio: "Passionate about acoustic guitar.",
    location: "Bengaluru",
    avatarUrl: "https://example.com/avatar.jpg",
    skillsTeach: [
      { skill: { id: "skill-2", name: "Acoustic Guitar" }, proficiency: "Expert" },
    ],
    skillsLearn: [
      { skill: { id: "skill-1", name: "JavaScript / React" } },
    ],
    reviewsReceived: [{ rating: 5 }],
    ...overrides,
  });

  describe("calculateRating", () => {
    it("returns default 4.9 rating and 0 reviews when no reviews exist", () => {
      const result = calculateRating([]);
      expect(result.avgRating).toBe(4.9);
      expect(result.reviewCount).toBe(0);
    });

    it("calculates exact average rating rounded to 1 decimal place", () => {
      const result = calculateRating([{ rating: 5 }, { rating: 4 }]);
      expect(result.avgRating).toBe(4.5);
      expect(result.reviewCount).toBe(2);
    });

    it("handles multiple ratings correctly (rounding to 1 decimal place)", () => {
      const result = calculateRating([{ rating: 5 }, { rating: 5 }, { rating: 4 }]);
      expect(result.avgRating).toBe(4.7);
      expect(result.reviewCount).toBe(3);
    });
  });

  describe("determineMatchedSkillName", () => {
    it("picks first matching skill wanted by the user", () => {
      const matched = determineMatchedSkillName(
        [{ skill: { id: "s1", name: "Acoustic Guitar" }, proficiency: "Beginner" }],
        [{ skill: { id: "s2", name: "Singing" }, proficiency: "Advanced" }]
      );
      expect(matched).toBe("Acoustic Guitar");
    });

    it("falls back to first skill peer teaches when user wants no skill from peer", () => {
      const matched = determineMatchedSkillName(
        [],
        [{ skill: { id: "s2", name: "Singing" }, proficiency: "Advanced" }]
      );
      expect(matched).toBe("Singing");
    });

    it("falls back to 'General Skill Swap' when peer has zero taught skills", () => {
      const matched = determineMatchedSkillName([], []);
      expect(matched).toBe("General Skill Swap");
    });
  });

  describe("determineRequestDirection", () => {
    it("returns 'SENT' when status is PENDING and currentUserId is userAId", () => {
      expect(
        determineRequestDirection({
          userAId: "user-1",
          userBId: "user-2",
          currentUserId: "user-1",
          status: "PENDING",
        })
      ).toBe("SENT");
    });

    it("returns 'RECEIVED' when status is PENDING and currentUserId is userBId", () => {
      expect(
        determineRequestDirection({
          userAId: "user-1",
          userBId: "user-2",
          currentUserId: "user-2",
          status: "PENDING",
        })
      ).toBe("RECEIVED");
    });

    it("returns null when status is not PENDING", () => {
      expect(
        determineRequestDirection({
          userAId: "user-1",
          userBId: "user-2",
          currentUserId: "user-1",
          status: "ACCEPTED",
        })
      ).toBeNull();
      expect(
        determineRequestDirection({
          userAId: "user-1",
          userBId: "user-2",
          currentUserId: "user-2",
          status: "DECLINED",
        })
      ).toBeNull();
    });

    it("returns null when currentUserId is neither userAId nor userBId", () => {
      expect(
        determineRequestDirection({
          userAId: "user-1",
          userBId: "user-2",
          currentUserId: "user-3",
          status: "PENDING",
        })
      ).toBeNull();
    });
  });

  describe("findConnectionStatus", () => {
    it("returns NONE and null matchId when no match exists", () => {
      const status = findConnectionStatus("user-a", "user-b", []);
      expect(status.connectionStatus).toBe("NONE");
      expect(status.matchId).toBeNull();
      expect(status.requestDirection).toBeNull();
    });

    it("detects match when current user is userA (requester) with requestDirection 'SENT'", () => {
      const matches = [
        { id: "match-123", userAId: "user-a", userBId: "user-b", status: "PENDING" },
      ];
      const status = findConnectionStatus("user-a", "user-b", matches);
      expect(status.connectionStatus).toBe("PENDING");
      expect(status.matchId).toBe("match-123");
      expect(status.requestDirection).toBe("SENT");
    });

    it("detects match when current user is userB (recipient) with requestDirection 'RECEIVED'", () => {
      const matches = [
        { id: "match-123", userAId: "user-b", userBId: "user-a", status: "PENDING" },
      ];
      const status = findConnectionStatus("user-a", "user-b", matches);
      expect(status.connectionStatus).toBe("PENDING");
      expect(status.matchId).toBe("match-123");
      expect(status.requestDirection).toBe("RECEIVED");
    });

    it("detects ACCEPTED match status with requestDirection null", () => {
      const matches = [
        { id: "match-456", userAId: "user-b", userBId: "user-a", status: "ACCEPTED" },
      ];
      const status = findConnectionStatus("user-a", "user-b", matches);
      expect(status.connectionStatus).toBe("ACCEPTED");
      expect(status.matchId).toBe("match-456");
      expect(status.requestDirection).toBeNull();
    });

    it("detects DECLINED match status correctly", () => {
      const matches = [
        { id: "match-789", userAId: "user-b", userBId: "user-a", status: "DECLINED" },
      ];
      const status = findConnectionStatus("user-a", "user-b", matches);
      expect(status.connectionStatus).toBe("DECLINED");
      expect(status.matchId).toBe("match-789");
      expect(status.requestDirection).toBeNull();
    });
  });

  describe("computePeerMatch", () => {
    it("flags mutual swap when user teaches what peer wants AND peer teaches what user wants", () => {
      const currentUser = createMockUser();
      const peer = createMockPeer();
      const result = computePeerMatch(currentUser, peer, []);

      expect(result.isMutual).toBe(true);
      expect(result.matchedSkillName).toBe("Acoustic Guitar");
      expect(result.connectionStatus).toBe("NONE");
      expect(result.avgRating).toBe(5);
      expect(result.reviewCount).toBe(1);
    });

    it("does NOT flag mutual when peer teaches what user wants but peer wants something user does not teach", () => {
      const currentUser = createMockUser({
        skillsTeach: [{ skill: { id: "s-react", name: "JavaScript / React" }, proficiency: "Advanced" }],
        skillsLearn: [{ skill: { id: "s-guitar", name: "Acoustic Guitar" } }],
      });
      const peer = createMockPeer({
        skillsTeach: [{ skill: { id: "s-guitar", name: "Acoustic Guitar" }, proficiency: "Expert" }],
        skillsLearn: [{ skill: { id: "s-french", name: "French" } }], // user doesn't teach French
      });

      const result = computePeerMatch(currentUser, peer, []);
      expect(result.isMutual).toBe(false);
      expect(result.matchedSkillName).toBe("Acoustic Guitar"); // still wanted by user
    });

    it("does NOT flag mutual when user teaches what peer wants but user does not want what peer teaches", () => {
      const currentUser = createMockUser({
        skillsTeach: [{ skill: { id: "s-react", name: "JavaScript / React" }, proficiency: "Advanced" }],
        skillsLearn: [{ skill: { id: "s-guitar", name: "Acoustic Guitar" } }],
      });
      const peer = createMockPeer({
        skillsTeach: [{ skill: { id: "s-pottery", name: "Pottery" }, proficiency: "Expert" }], // user doesn't want Pottery
        skillsLearn: [{ skill: { id: "s-react", name: "JavaScript / React" } }],
      });

      const result = computePeerMatch(currentUser, peer, []);
      expect(result.isMutual).toBe(false);
      expect(result.matchedSkillName).toBe("Pottery"); // fallback to first peer taught skill
    });

    it("handles peers with zero skills (e.g. 'ray' in dashboard) without crashing", () => {
      const currentUser = createMockUser();
      const emptyPeer = {
        id: "ray-id",
        name: "Ray",
        email: "ray@example.com",
        bio: null,
        location: null,
        avatarUrl: null,
        skillsTeach: [],
        skillsLearn: [],
        reviewsReceived: [],
      };

      const result = computePeerMatch(currentUser, emptyPeer, []);
      expect(result.isMutual).toBe(false);
      expect(result.matchedSkillName).toBe("General Skill Swap");
      expect(result.bio).toBe("No bio added yet.");
      expect(result.location).toBe("Nearby");
      expect(result.avatarUrl).toBe("");
      expect(result.avgRating).toBe(4.9);
      expect(result.reviewCount).toBe(0);
      expect(result.skillsTeach).toEqual([]);
      expect(result.skillsLearn).toEqual([]);
    });

    it("performs case-insensitive skill matching", () => {
      const currentUser = createMockUser({
        skillsTeach: [{ skill: { id: "s1", name: "JAVASCRIPT / REACT" }, proficiency: "Advanced" }],
        skillsLearn: [{ skill: { id: "s2", name: "acoustic guitar" } }],
      });
      const peer = createMockPeer({
        skillsTeach: [{ skill: { id: "s2", name: "Acoustic Guitar" }, proficiency: "Expert" }],
        skillsLearn: [{ skill: { id: "s1", name: "javascript / react" } }],
      });

      const result = computePeerMatch(currentUser, peer, []);
      expect(result.isMutual).toBe(true);
      expect(result.matchedSkillName).toBe("Acoustic Guitar");
    });
  });

  describe("computeAllMatches", () => {
    it("excludes the current user from their own match results", () => {
      const currentUser = createMockUser({ id: "user-self" });
      const peerA = createMockPeer({ id: "peer-a", name: "Peer A" });
      const peerSelf = createMockPeer({ id: "user-self", name: "Self Duplicate" });
      const peerB = createMockPeer({ id: "peer-b", name: "Peer B" });

      const result = computeAllMatches(currentUser, [peerA, peerSelf, peerB], []);

      expect(result.matches).toHaveLength(2);
      expect(result.matches.some((m) => m.id === "user-self")).toBe(false);
      expect(result.matches.map((m) => m.id)).toEqual(["peer-a", "peer-b"]);
    });

    it("preserves peer list order exactly as provided", () => {
      const currentUser = createMockUser();
      const peer1 = createMockPeer({ id: "p1", name: "Aarav" });
      const peer2 = createMockPeer({ id: "p2", name: "Priya" });
      const peer3 = createMockPeer({ id: "p3", name: "Rohan" });

      const result = computeAllMatches(currentUser, [peer1, peer2, peer3], []);
      expect(result.matches.map((m) => m.id)).toEqual(["p1", "p2", "p3"]);
    });

    it("populates currentUser summary fields accurately", () => {
      const currentUser = createMockUser({
        id: "curr-123",
        name: "Alex Kumar",
        email: "alex@example.com",
        location: "Bengaluru",
        skillsTeach: [{ skill: { id: "s1", name: "Tech" }, proficiency: "Expert" }],
        skillsLearn: [
          { skill: { id: "s2", name: "Art" } },
          { skill: { id: "s3", name: "Music" } },
        ],
      });

      const result = computeAllMatches(currentUser, [], []);
      expect(result.currentUser).toEqual({
        id: "curr-123",
        name: "Alex Kumar",
        email: "alex@example.com",
        location: "Bengaluru",
        teachCount: 1,
        learnCount: 2,
      });
      expect(result.matches).toEqual([]);
    });

    it("handles empty peer list cleanly without errors", () => {
      const currentUser = createMockUser();
      const result = computeAllMatches(currentUser, [], []);
      expect(result.matches).toEqual([]);
    });
  });
});

