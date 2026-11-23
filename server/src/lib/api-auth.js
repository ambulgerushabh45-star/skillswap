import { prisma } from '../db/prisma.js';
import { sendBadRequest, sendNotFound, sendForbidden } from './api-error.js';

/**
 * Pure evaluation of review creation eligibility rules:
 * - 400: Self-review prohibited
 * - 404: Target user must exist
 * - 409: One review per reviewer and reviewed person
 * - 403: Reviewer and recipient must have an ACCEPTED match
 */
export function evaluateReviewEligibility(input) {
  if (input.reviewerId === input.toUserId) {
    return { allowed: false, status: 400, error: "You cannot review yourself" };
  }
  if (!input.targetUserExists) {
    return { allowed: false, status: 404, error: "Recipient user not found" };
  }
  if (input.hasExistingReview) {
    return {
      allowed: false,
      status: 409,
      error: "You have already reviewed this person.",
    };
  }
  if (!input.match || input.match.status !== "ACCEPTED") {
    return {
      allowed: false,
      status: 403,
      error: "You can only review users you have an accepted match with",
    };
  }
  return { allowed: true };
}

/**
 * Retrieves a match by ID and verifies if the user is a participant (userA or userB).
 */
export async function getMatchForParticipant(res, matchId, userId) {
  if (!matchId) {
    sendBadRequest(res, "Match ID is required");
    return null;
  }

  const match = await prisma.match.findUnique({
    where: { id: matchId },
  });

  if (!match) {
    sendNotFound(res, "Match not found");
    return null;
  }

  const isUserA = match.userAId === userId;
  const isUserB = match.userBId === userId;

  if (!isUserA && !isUserB) {
    sendForbidden(res, "Forbidden: You are not a participant in this match");
    return null;
  }

  return { match, isUserA, isUserB };
}

/**
 * Pure evaluation of messaging eligibility on a match:
 * - 409: DECLINED match -> blocked
 * - 409: PENDING match & sender is not requester -> blocked
 * - 409: PENDING match & requester already sent 3 messages -> blocked
 * - allowed: ACCEPTED match or PENDING match with < 3 messages from requester
 */
export function evaluateMessagingEligibility({ match, senderId, messageCount = 0 }) {
  if (!match) {
    return { allowed: false, status: 404, error: 'Match not found' };
  }

  if (match.status === 'DECLINED') {
    return {
      allowed: false,
      status: 409,
      error: 'This connection request was declined.',
    };
  }

  if (match.status === 'PENDING') {
    const isRequester = match.userAId === senderId;
    if (!isRequester) {
      return {
        allowed: false,
        status: 409,
        error: 'Accept the request to reply.',
      };
    }
    if (messageCount >= 3) {
      return {
        allowed: false,
        status: 409,
        error: 'You can send up to 3 messages until the request is accepted.',
      };
    }
  }

  return { allowed: true };
}

