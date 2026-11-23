import { Router } from 'express';
import { prisma } from '../db/prisma.js';
import { requireSession } from '../middleware/auth.js';
import {
  parseParams,
  parseQuery,
  sendNotFound,
  sendInternalError,
} from '../lib/api-error.js';
import { userIdParamSchema } from '../lib/validators/profile.js';
import { pagePaginationQuerySchema } from '../lib/validators/pagination.js';
import {
  clampLimit,
  buildPagePaginationMeta,
  sendPaginated,
} from '../lib/pagination.js';
import {
  buildRatingSummary,
  resolveViewerState,
  buildSafeProfileUser,
} from '../lib/profile-view.js';

const router = Router();

// GET /api/users/:id
router.get('/:id', requireSession, async (req, res) => {
  try {
    // 1. Validate route param (400)
    const parsedParams = parseParams(req.params, userIdParamSchema);
    if (!parsedParams.success) {
      return res.status(400).json({ error: parsedParams.error, details: parsedParams.details });
    }
    const targetUserId = parsedParams.data.id;

    // 2. Validate query params (400)
    const parsedQuery = parseQuery(req.query, pagePaginationQuerySchema);
    if (!parsedQuery.success) {
      return res.status(400).json({ error: parsedQuery.error, details: parsedQuery.details });
    }

    const page = parsedQuery.data.page ?? 1;
    const limit = clampLimit(parsedQuery.data.limit, 50);
    const skip = (page - 1) * limit;

    // 3. Query target user with explicit privacy projection
    const targetUser = await prisma.user.findUnique({
      where: { id: targetUserId },
      select: {
        id: true,
        name: true,
        avatarUrl: true,
        bio: true,
        location: true,
        skillsTeach: {
          select: {
            proficiency: true,
            skill: {
              select: {
                name: true,
                category: true,
              },
            },
          },
        },
        skillsLearn: {
          select: {
            skill: {
              select: {
                name: true,
                category: true,
              },
            },
          },
        },
      },
    });

    if (!targetUser) {
      return sendNotFound(res, 'User not found');
    }

    // 4. Parallel queries for reviews, ratings, match & existing review
    const [reviewCount, aggregateRating, reviews, match, existingReview] =
      await Promise.all([
        prisma.review.count({ where: { toUserId: targetUserId } }),
        prisma.review.aggregate({
          where: { toUserId: targetUserId },
          _avg: { rating: true },
        }),
        prisma.review.findMany({
          where: { toUserId: targetUserId },
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          skip,
          take: limit,
          select: {
            id: true,
            rating: true,
            comment: true,
            createdAt: true,
            fromUser: {
              select: {
                id: true,
                name: true,
                avatarUrl: true,
              },
            },
          },
        }),
        prisma.match.findFirst({
          where: {
            OR: [
              { userAId: req.user.id, userBId: targetUserId },
              { userAId: targetUserId, userBId: req.user.id },
            ],
          },
          select: { id: true, status: true, userAId: true, userBId: true },
        }),
        prisma.review.findFirst({
          where: {
            fromUserId: req.user.id,
            toUserId: targetUserId,
          },
          select: { id: true },
        }),
      ]);

    // 5. Assemble domain views
    const safeUser = buildSafeProfileUser(targetUser);
    const ratingSummary = buildRatingSummary(
      aggregateRating._avg.rating,
      reviewCount
    );
    const viewer = resolveViewerState(
      req.user.id,
      targetUserId,
      match,
      Boolean(existingReview)
    );
    const paginationMeta = buildPagePaginationMeta(reviewCount, page, limit);

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

    return sendPaginated(
      res,
      {
        user: safeUser,
        rating: ratingSummary,
        reviews: formattedReviews,
        viewer,
      },
      paginationMeta
    );
  } catch (error) {
    return sendInternalError(res, error, 'Failed to load public profile');
  }
});

export default router;

