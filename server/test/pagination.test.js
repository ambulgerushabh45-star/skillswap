import { describe, it, expect } from "vitest";
import {
  clampLimit,
  buildPagePaginationMeta,
  buildCursorPaginationMeta,
  getPaginationHeaders,
  createPaginatedResponse,
} from "../src/lib/pagination.js";
import {
  pagePaginationQuerySchema,
  getMessagesQuerySchema,
  getReviewsQuerySchema,
} from "../src/lib/validators/index.js";

describe("src/lib/pagination.js Unit Tests", () => {
  describe("clampLimit", () => {
    it("applies default cap when client limit is undefined or NaN", () => {
      expect(clampLimit(undefined, 100)).toBe(100);
      expect(clampLimit(undefined, 200)).toBe(200);
      expect(clampLimit(undefined, 50)).toBe(50);
      expect(clampLimit(NaN, 100)).toBe(100);
    });

    it("clamps client limit to min 1", () => {
      expect(clampLimit(0, 100)).toBe(1);
      expect(clampLimit(-10, 100)).toBe(1);
    });

    it("clamps client limit to maxLimit (default 100)", () => {
      expect(clampLimit(100000, 100)).toBe(100);
      expect(clampLimit(101, 100)).toBe(100);
      expect(clampLimit(250, 100, 100)).toBe(100);
    });

    it("returns valid client limit within 1..100 range untouched", () => {
      expect(clampLimit(1, 100)).toBe(1);
      expect(clampLimit(25, 100)).toBe(25);
      expect(clampLimit(50, 100)).toBe(50);
      expect(clampLimit(100, 100)).toBe(100);
    });
  });

  describe("buildPagePaginationMeta", () => {
    it("handles empty list (total = 0)", () => {
      const meta = buildPagePaginationMeta(0, 1, 10);
      expect(meta).toEqual({
        total: 0,
        page: 1,
        limit: 10,
        totalPages: 1,
        hasNextPage: false,
        hasPrevPage: false,
      });
    });

    it("handles list with fewer items than limit", () => {
      const meta = buildPagePaginationMeta(5, 1, 10);
      expect(meta).toEqual({
        total: 5,
        page: 1,
        limit: 10,
        totalPages: 1,
        hasNextPage: false,
        hasPrevPage: false,
      });
    });

    it("handles a page exactly at the limit", () => {
      const meta = buildPagePaginationMeta(10, 1, 10);
      expect(meta).toEqual({
        total: 10,
        page: 1,
        limit: 10,
        totalPages: 1,
        hasNextPage: false,
        hasPrevPage: false,
      });
    });

    it("handles first page of multi-page results", () => {
      const meta = buildPagePaginationMeta(25, 1, 10);
      expect(meta).toEqual({
        total: 25,
        page: 1,
        limit: 10,
        totalPages: 3,
        hasNextPage: true,
        hasPrevPage: false,
      });
    });

    it("handles middle page of multi-page results", () => {
      const meta = buildPagePaginationMeta(25, 2, 10);
      expect(meta).toEqual({
        total: 25,
        page: 2,
        limit: 10,
        totalPages: 3,
        hasNextPage: true,
        hasPrevPage: true,
      });
    });

    it("handles last page of multi-page results (no next page)", () => {
      const meta = buildPagePaginationMeta(25, 3, 10);
      expect(meta).toEqual({
        total: 25,
        page: 3,
        limit: 10,
        totalPages: 3,
        hasNextPage: false,
        hasPrevPage: true,
      });
    });

    it("handles request past last page safely", () => {
      const meta = buildPagePaginationMeta(25, 5, 10);
      expect(meta.hasNextPage).toBe(false);
      expect(meta.totalPages).toBe(3);
    });
  });

  describe("buildCursorPaginationMeta", () => {
    it("handles empty list or no more older messages", () => {
      const meta = buildCursorPaginationMeta(0, 200, null);
      expect(meta).toEqual({
        total: 0,
        limit: 200,
        hasMore: false,
        nextCursor: null,
      });
    });

    it("handles active nextCursor for older messages", () => {
      const meta = buildCursorPaginationMeta(50, 10, "msg-12345");
      expect(meta).toEqual({
        total: 50,
        limit: 10,
        hasMore: true,
        nextCursor: "msg-12345",
      });
    });
  });

  describe("getPaginationHeaders", () => {
    it("generates page-based pagination headers including next-page", () => {
      const meta = buildPagePaginationMeta(30, 1, 10);
      const headers = getPaginationHeaders(meta);
      expect(headers["X-Total-Count"]).toBe("30");
      expect(headers["X-Page"]).toBe("1");
      expect(headers["X-Limit"]).toBe("10");
      expect(headers["X-Total-Pages"]).toBe("3");
      expect(headers["X-Has-Next-Page"]).toBe("true");
      expect(headers["X-Next-Page"]).toBe("2");
    });

    it("omits X-Next-Page when hasNextPage is false", () => {
      const meta = buildPagePaginationMeta(10, 1, 10);
      const headers = getPaginationHeaders(meta);
      expect(headers["X-Has-Next-Page"]).toBe("false");
      expect(headers["X-Next-Page"]).toBeUndefined();
    });

    it("generates cursor-based pagination headers", () => {
      const meta = buildCursorPaginationMeta(5, 2, "msg-999");
      const headers = getPaginationHeaders(meta);
      expect(headers["X-Total-Count"]).toBe("5");
      expect(headers["X-Limit"]).toBe("2");
      expect(headers["X-Has-More"]).toBe("true");
      expect(headers["X-Next-Cursor"]).toBe("msg-999");
    });

    it("omits X-Next-Cursor when hasMore is false", () => {
      const meta = buildCursorPaginationMeta(5, 2, null);
      const headers = getPaginationHeaders(meta);
      expect(headers["X-Has-More"]).toBe("false");
      expect(headers["X-Next-Cursor"]).toBeUndefined();
    });
  });

  describe("createPaginatedResponse", () => {
    it("returns JSON with existing fields preserved, pagination object added, and headers set", async () => {
      const payload = { items: ["a", "b"], status: "ok" };
      const meta = buildPagePaginationMeta(2, 1, 10);
      const res = createPaginatedResponse(payload, meta);

      expect(res.status).toBe(200);
      expect(res.headers.get("X-Total-Count")).toBe("2");
      expect(res.headers.get("X-Page")).toBe("1");

      const body = await res.json();
      expect(body.items).toEqual(["a", "b"]);
      expect(body.status).toBe("ok");
      expect(body.pagination).toEqual(meta);
    });
  });

  describe("Zod Pagination Schemas Validation", () => {
    it("accepts valid page and limit query params", () => {
      const parsed = pagePaginationQuerySchema.safeParse({ page: "2", limit: "15" });
      expect(parsed.success).toBe(true);
      if (parsed.success) {
        expect(parsed.data.page).toBe(2);
        expect(parsed.data.limit).toBe(15);
      }
    });

    it("accepts empty query params (defaults to undefined)", () => {
      const parsed = pagePaginationQuerySchema.safeParse({});
      expect(parsed.success).toBe(true);
      if (parsed.success) {
        expect(parsed.data.page).toBeUndefined();
        expect(parsed.data.limit).toBeUndefined();
      }
    });

    it("rejects invalid limit values (limit=0, limit=abc, limit=100000)", () => {
      expect(pagePaginationQuerySchema.safeParse({ limit: "0" }).success).toBe(false);
      expect(pagePaginationQuerySchema.safeParse({ limit: "abc" }).success).toBe(false);
      expect(pagePaginationQuerySchema.safeParse({ limit: "100000" }).success).toBe(false);
      expect(pagePaginationQuerySchema.safeParse({ limit: "-5" }).success).toBe(false);
    });

    it("rejects invalid page values (page=0, page=abc, page=-1)", () => {
      expect(pagePaginationQuerySchema.safeParse({ page: "0" }).success).toBe(false);
      expect(pagePaginationQuerySchema.safeParse({ page: "abc" }).success).toBe(false);
      expect(pagePaginationQuerySchema.safeParse({ page: "-1" }).success).toBe(false);
    });

    it("validates getMessagesQuerySchema with cursor and limit", () => {
      const valid = getMessagesQuerySchema.safeParse({
        matchId: "06cf5119-ea31-4fd4-96b4-a8ce75833237",
        limit: "10",
        cursor: "msg-123",
      });
      expect(valid.success).toBe(true);

      const invalidLimit = getMessagesQuerySchema.safeParse({
        matchId: "06cf5119-ea31-4fd4-96b4-a8ce75833237",
        limit: "0",
      });
      expect(invalidLimit.success).toBe(false);

      const emptyCursor = getMessagesQuerySchema.safeParse({
        matchId: "06cf5119-ea31-4fd4-96b4-a8ce75833237",
        cursor: "   ",
      });
      expect(emptyCursor.success).toBe(false);
    });

    it("validates getReviewsQuerySchema with toUserId, page, and limit", () => {
      const valid = getReviewsQuerySchema.safeParse({
        toUserId: "9c7163f4-3d9a-4e2e-84b2-04e38e6cfcf7",
        page: "1",
        limit: "20",
      });
      expect(valid.success).toBe(true);

      const missingUser = getReviewsQuerySchema.safeParse({ page: "1" });
      expect(missingUser.success).toBe(false);
    });
  });
});

