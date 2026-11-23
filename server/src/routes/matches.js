import { Router } from 'express';
import { prisma } from '../db/prisma.js';
import { requireSession } from '../middleware/auth.js';
import { getMatchForParticipant } from '../lib/api-auth.js';
import {
  parseBody,
  parseQuery,
  parseParams,
  sendBadRequest,
  sendNotFound,
  sendForbidden,
  sendInternalError,
  sendTooManyRequests,
} from '../lib/api-error.js';
import {
  createMatchSchema,
  pagePaginationQuerySchema,
  matchIdParamSchema,
  updateMatchStatusSchema,
} from '../lib/validators/index.js';
import { computeAllMatches } from '../lib/matching.js';
import { haversineKm, isValidCoordinate, roundKm } from '../lib/geo.js';
import { rateLimit } from '../lib/rate-limit.js';
import {
  clampLimit,
  buildPagePaginationMeta,
  sendPaginated,
} from '../lib/pagination.js';
import { sendEmail, checkConnectionPairLimit } from '../lib/email.js';
import {
  buildNewConnectionRequestTemplate,
  buildConnectionAcceptedTemplate,
} from '../lib/email-templates.js';

const router = Router();

// GET /api/matches
router.get('/', requireSession, async (req, res) => {
  try {
    const parsedQuery = parseQuery(req.query, pagePaginationQuerySchema);
    if (!parsedQuery.success) {
      return res.status(400).json({ error: parsedQuery.error, details: parsedQuery.details });
    }

    const page = parsedQuery.data.page ?? 1;
    const limit = clampLimit(parsedQuery.data.limit, 100);

    const [currentUser, otherUsers, matches] = await Promise.all([
      prisma.user.findUnique({
        where: { id: req.user.id },
        include: {
          skillsTeach: { include: { skill: true } },
          skillsLearn: { include: { skill: true } },
        },
      }),
      prisma.user.findMany({
        where: {
          id: { not: req.user.id },
        },
        include: {
          skillsTeach: { include: { skill: true } },
          skillsLearn: { include: { skill: true } },
          reviewsReceived: { select: { rating: true } },
        },
      }),
      prisma.match.findMany({
        where: {
          OR: [{ userAId: req.user.id }, { userBId: req.user.id }],
        },
      }),
    ]);

    if (!currentUser) {
      return sendNotFound(res, 'User not found');
    }

    const hasLocation = isValidCoordinate(currentUser.latitude, currentUser.longitude);

    const userCoordMap = new Map();
    for (const u of otherUsers) {
      userCoordMap.set(u.id, { lat: u.latitude, lng: u.longitude });
    }

    const responsePayload = computeAllMatches(currentUser, otherUsers, matches);
    const allMatches = responsePayload.matches;
    const total = allMatches.length;

    const offset = (page - 1) * limit;
    const paginatedMatches = allMatches.slice(offset, offset + limit);

    const paginatedMatchesWithDistance = paginatedMatches.map((m) => {
      const coords = userCoordMap.get(m.id);
      let distanceKm = null;
      if (hasLocation && coords && isValidCoordinate(coords.lat, coords.lng)) {
        const rawDist = haversineKm(
          currentUser.latitude,
          currentUser.longitude,
          coords.lat,
          coords.lng
        );
        distanceKm = roundKm(rawDist, 1);
      }
      return {
        ...m,
        distanceKm,
      };
    });

    const meta = buildPagePaginationMeta(total, page, limit);

    return sendPaginated(
      res,
      {
        currentUser: {
          ...responsePayload.currentUser,
          hasLocation,
        },
        matches: paginatedMatchesWithDistance,
      },
      meta
    );
  } catch (error) {
    return sendInternalError(res, error, 'Failed to load matches');
  }
});

// POST /api/matches
router.post('/', requireSession, async (req, res) => {
  try {
    const rl = rateLimit(`matches:create:${req.user.id}`, { limit: 20, windowSeconds: 3600 });
    if (!rl.ok) {
      return sendTooManyRequests(res, rl.retryAfterSeconds, rl.limit, rl.remaining);
    }

    const parsed = parseBody(req, createMatchSchema);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error, details: parsed.details });
    }

    const { targetUserId, matchedSkillName } = parsed.data;

    if (targetUserId === req.user.id) {
      return sendBadRequest(res, 'Cannot connect with yourself');
    }

    const targetUser = await prisma.user.findUnique({
      where: { id: targetUserId },
      select: { id: true },
    });

    if (!targetUser) {
      return sendNotFound(res, 'Target user not found');
    }

    const skill = await prisma.skill.upsert({
      where: { name: matchedSkillName || 'General Skill Swap' },
      update: {},
      create: { name: matchedSkillName || 'General Skill Swap', category: 'General' },
    });

    const existingMatch = await prisma.match.findFirst({
      where: {
        OR: [
          { userAId: req.user.id, userBId: targetUserId },
          { userAId: targetUserId, userBId: req.user.id },
        ],
      },
    });

    if (existingMatch) {
      return res.status(200).json({ message: 'Connection request already exists', match: existingMatch });
    }

    const newMatch = await prisma.match.create({
      data: {
        userAId: req.user.id,
        userBId: targetUserId,
        matchedSkillId: skill.id,
        status: 'PENDING',
      },
    });

    // Fire-and-forget: new connection request email to recipient
    (async () => {
      try {
        if (!checkConnectionPairLimit(req.user.id, targetUserId)) {
          return;
        }
        const [recipient, requester] = await Promise.all([
          prisma.user.findUnique({
            where: { id: targetUserId },
            select: { name: true, email: true, emailNotifications: true },
          }),
          prisma.user.findUnique({
            where: { id: req.user.id },
            select: { name: true },
          }),
        ]);

        if (recipient && recipient.emailNotifications !== false) {
          const template = buildNewConnectionRequestTemplate({
            recipientName: recipient.name,
            requesterName: requester?.name || 'A user',
            skillName: matchedSkillName || 'Skill Swap',
            matchId: newMatch.id,
          });
          await sendEmail({
            to: recipient.email,
            subject: template.subject,
            text: template.text,
            html: template.html,
          });
        }
      } catch {
        // ignore background email failure
      }
    })();

    return res.status(201).json({ message: 'Connection request sent!', match: newMatch });
  } catch (error) {
    return sendInternalError(res, error, 'Failed to send connection request');
  }
});

// PATCH /api/matches/:id
router.patch('/:id', requireSession, async (req, res) => {
  try {
    const rl = rateLimit(`matches:update:${req.user.id}`, { limit: 60, windowSeconds: 3600 });
    if (!rl.ok) {
      return sendTooManyRequests(res, rl.retryAfterSeconds, rl.limit, rl.remaining);
    }

    const parsedParams = parseParams(req.params, matchIdParamSchema);
    if (!parsedParams.success) {
      return res.status(400).json({ error: parsedParams.error, details: parsedParams.details });
    }
    const { id } = parsedParams.data;

    const parsedBody = parseBody(req, updateMatchStatusSchema);
    if (!parsedBody.success) {
      return res.status(400).json({ error: parsedBody.error, details: parsedBody.details });
    }
    const { status } = parsedBody.data;

    const matchResult = await getMatchForParticipant(res, id, req.user.id);
    if (!matchResult) return;

    if (!matchResult.isUserB) {
      return sendForbidden(
        res,
        'Forbidden: Only the recipient of the connection request can accept or decline it'
      );
    }

    const updatedMatch = await prisma.match.update({
      where: { id },
      data: { status },
    });

    // Fire-and-forget: request accepted email to requester
    if (status === 'ACCEPTED') {
      (async () => {
        try {
          const [requester, recipient, skill] = await Promise.all([
            prisma.user.findUnique({
              where: { id: updatedMatch.userAId },
              select: { name: true, email: true, emailNotifications: true },
            }),
            prisma.user.findUnique({
              where: { id: req.user.id },
              select: { name: true },
            }),
            prisma.skill.findUnique({
              where: { id: updatedMatch.matchedSkillId },
              select: { name: true },
            }),
          ]);

          if (requester && requester.emailNotifications !== false) {
            const template = buildConnectionAcceptedTemplate({
              requesterName: requester.name,
              recipientName: recipient?.name || 'Your peer',
              skillName: skill?.name || 'Skill Swap',
              matchId: updatedMatch.id,
            });
            await sendEmail({
              to: requester.email,
              subject: template.subject,
              text: template.text,
              html: template.html,
            });
          }
        } catch {
          // ignore background email failure
        }
      })();
    }

    return res.status(200).json({
      message: `Match status updated to ${status}`,
      match: updatedMatch,
    });
  } catch (error) {
    return sendInternalError(res, error, 'Failed to update match status');
  }
});

export default router;

