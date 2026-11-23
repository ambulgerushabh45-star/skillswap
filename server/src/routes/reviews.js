import { Router } from 'express';
import { prisma } from '../db/prisma.js';
import { requireSession } from '../middleware/auth.js';
import { evaluateReviewEligibility } from '../lib/api-auth.js';
import {
  parseBody,
  parseQuery,
  sendBadRequest,
  sendForbidden,
  sendNotFound,
  sendConflict,
  sendInternalError,
  sendTooManyRequests,
} from '../lib/api-error.js';
import {
  getReviewsQuerySchema,
  createReviewSchema,
} from '../lib/validators/index.js';
import { rateLimit } from '../lib/rate-limit.js';
import {
  clampLimit,
  buildPagePaginationMeta,
  sendPaginated,
} from '../lib/pagination.js';

const router = Router();

// GET /api/reviews
router.get('/', requireSession, async (req, res) => {
  try {
    const parsedQuery = parseQuery(req.query, getReviewsQuerySchema);
    if (!parsedQuery.success) {
      return res.status(400).json({ error: parsedQuery.error, details: parsedQuery.details });
    }
    const { toUserId } = parsedQuery.data;

    const page = parsedQuery.data.page ?? 1;
    const limit = clampLimit(parsedQuery.data.limit, 50);
    const skip = (page - 1) * limit;

    const [totalReviews, aggregateRating, reviews] = await Promise.all([
      prisma.review.count({ where: { toUserId } }),
      prisma.review.aggregate({
        where: { toUserId },
        _avg: { rating: true },
      }),
      prisma.review.findMany({
        where: { toUserId },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip,
        take: limit,
        include: {
          fromUser: {
            select: { id: true, name: true, avatarUrl: true },
          },
        },
      }),
    ]);

    const rawAvg = aggregateRating._avg.rating;
    const avgRating = rawAvg !== null ? parseFloat(rawAvg.toFixed(1)) : 5.0;

    const formattedReviews = reviews.map((r) => ({
      id: r.id,
      rating: r.rating,
      comment: r.comment,
      createdAt: r.createdAt.toISOString(),
      fromUser: {
        id: r.fromUser.id,
        name: r.fromUser.name,
        avatarUrl: r.fromUser.avatarUrl || '',
      },
    }));

    const meta = buildPagePaginationMeta(totalReviews, page, limit);

    return sendPaginated(
      res,
      {
        avgRating,
        totalReviews,
        reviews: formattedReviews,
      },
      meta
    );
  } catch (error) {
    return sendInternalError(res, error, 'Failed to load reviews');
  }
});

// POST /api/reviews
router.post('/', requireSession, async (req, res) => {
  try {
    const rl = rateLimit(`reviews:create:${req.user.id}`, { limit: 10, windowSeconds: 3600 });
    if (!rl.ok) {
      return sendTooManyRequests(res, rl.retryAfterSeconds, rl.limit, rl.remaining);
    }

    const parsed = parseBody(req, createReviewSchema);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error, details: parsed.details });
    }
    const { toUserId, rating, comment } = parsed.data;

    if (req.user.id === toUserId) {
      return sendBadRequest(res, 'You cannot review yourself');
    }

    const toUser = await prisma.user.findUnique({
      where: { id: toUserId },
      select: { id: true },
    });
    if (!toUser) {
      return sendNotFound(res, 'Recipient user not found');
    }

    const existingReview = await prisma.review.findFirst({
      where: {
        fromUserId: req.user.id,
        toUserId,
      },
      select: { id: true },
    });

    const match = await prisma.match.findFirst({
      where: {
        OR: [
          { userAId: req.user.id, userBId: toUserId },
          { userAId: toUserId, userBId: req.user.id },
        ],
      },
      select: { status: true },
    });

    const eligibility = evaluateReviewEligibility({
      reviewerId: req.user.id,
      toUserId,
      targetUserExists: Boolean(toUser),
      hasExistingReview: Boolean(existingReview),
      match,
    });

    if (!eligibility.allowed) {
      if (eligibility.status === 400) return sendBadRequest(res, eligibility.error);
      if (eligibility.status === 404) return sendNotFound(res, eligibility.error);
      if (eligibility.status === 409) return sendConflict(res, eligibility.error);
      return sendForbidden(res, eligibility.error);
    }

    const review = await prisma.$transaction(async (tx) => {
      const concurrentExisting = await tx.review.findFirst({
        where: {
          fromUserId: req.user.id,
          toUserId,
        },
        select: { id: true },
      });

      if (concurrentExisting) {
        throw new Error('ALREADY_REVIEWED');
      }

      return tx.review.create({
        data: {
          fromUserId: req.user.id,
          toUserId,
          rating,
          comment,
        },
        include: {
          fromUser: {
            select: { id: true, name: true, avatarUrl: true },
          },
        },
      });
    });

    return res.status(201).json({
      review: {
        id: review.id,
        rating: review.rating,
        comment: review.comment,
        createdAt: review.createdAt.toISOString(),
        fromUser: {
          id: review.fromUser.id,
          name: review.fromUser.name,
          avatarUrl: review.fromUser.avatarUrl || '',
        },
      },
    });
  } catch (error) {
    if (error?.message === 'ALREADY_REVIEWED' || error?.code === 'P2002' || error?.code === 'P2034') {
      return sendConflict(res, 'You have already reviewed this person.');
    }
    return sendInternalError(res, error, 'Failed to submit review');
  }
});

export default router;

