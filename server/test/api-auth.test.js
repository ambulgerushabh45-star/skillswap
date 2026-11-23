import { describe, it, expect } from "vitest";
import { evaluateReviewEligibility } from "../src/lib/api-auth.js";

describe("evaluateReviewEligibility", () => {
  const baseInput = {
    reviewerId: "user-alex",
    toUserId: "user-priya",
    targetUserExists: true,
    hasExistingReview: false,
    match: { status: "ACCEPTED" },
  };

  it("allows review when all eligibility criteria are satisfied", () => {
    const result = evaluateReviewEligibility(baseInput);
    expect(result).toEqual({ allowed: true });
  });

  it("blocks self-review with 400 Bad Request", () => {
    const result = evaluateReviewEligibility({
      ...baseInput,
      toUserId: "user-alex",
    });
    expect(result).toEqual({
      allowed: false,
      status: 400,
      error: "You cannot review yourself",
    });
  });

  it("blocks review when recipient user does not exist with 404 Not Found", () => {
    const result = evaluateReviewEligibility({
      ...baseInput,
      targetUserExists: false,
    });
    expect(result).toEqual({
      allowed: false,
      status: 404,
      error: "Recipient user not found",
    });
  });

  it("blocks duplicate review with 409 Conflict", () => {
    const result = evaluateReviewEligibility({
      ...baseInput,
      hasExistingReview: true,
    });
    expect(result).toEqual({
      allowed: false,
      status: 409,
      error: "You have already reviewed this person.",
    });
  });

  it("blocks review when no mutual match exists with 403 Forbidden", () => {
    const result = evaluateReviewEligibility({
      ...baseInput,
      match: null,
    });
    expect(result).toEqual({
      allowed: false,
      status: 403,
      error: "You can only review users you have an accepted match with",
    });
  });

  it("blocks review when match is PENDING with 403 Forbidden", () => {
    const result = evaluateReviewEligibility({
      ...baseInput,
      match: { status: "PENDING" },
    });
    expect(result).toEqual({
      allowed: false,
      status: 403,
      error: "You can only review users you have an accepted match with",
    });
  });

  it("blocks review when match is DECLINED with 403 Forbidden", () => {
    const result = evaluateReviewEligibility({
      ...baseInput,
      match: { status: "DECLINED" },
    });
    expect(result).toEqual({
      allowed: false,
      status: 403,
      error: "You can only review users you have an accepted match with",
    });
  });
});

