import { Router } from 'express';
import { prisma } from '../db/prisma.js';
import { requireSession } from '../middleware/auth.js';
import { parseQuery, sendInternalError } from '../lib/api-error.js';
import { pagePaginationQuerySchema } from '../lib/validators/index.js';
import { determineRequestDirection } from '../lib/matching.js';
import {
  clampLimit,
  buildPagePaginationMeta,
  sendPaginated,
} from '../lib/pagination.js';

const router = Router();

// GET /api/conversations
router.get('/', requireSession, async (req, res) => {
  try {
    const parsedQuery = parseQuery(req.query, pagePaginationQuerySchema);
    if (!parsedQuery.success) {
      return res.status(400).json({ error: parsedQuery.error, details: parsedQuery.details });
    }

    const page = parsedQuery.data.page ?? 1;
    const limit = clampLimit(parsedQuery.data.limit, 100);
    const skip = (page - 1) * limit;

    const whereClause = {
      OR: [{ userAId: req.user.id }, { userBId: req.user.id }],
    };

    const [total, matches] = await Promise.all([
      prisma.match.count({ where: whereClause }),
      prisma.match.findMany({
        where: whereClause,
        orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
        skip,
        take: limit,
        include: {
          userA: { select: { id: true, name: true, email: true, avatarUrl: true, location: true } },
          userB: { select: { id: true, name: true, email: true, avatarUrl: true, location: true } },
          matchedSkill: { select: { name: true } },
          messages: {
            orderBy: { createdAt: 'desc' },
            take: 1,
          },
        },
      }),
    ]);

    const conversations = matches.map((m) => {
      const isUserA = m.userAId === req.user.id;
      const peer = isUserA ? m.userB : m.userA;
      const lastMessage = m.messages.length > 0 ? m.messages[0] : null;
      const requestDirection = determineRequestDirection({
        userAId: m.userAId,
        userBId: m.userBId,
        currentUserId: req.user.id,
        status: m.status,
      });

      return {
        matchId: m.id,
        peerId: peer.id,
        peerName: peer.name,
        peerAvatar: peer.avatarUrl || '',
        peerLocation: peer.location || 'Nearby',
        matchedSkillName: m.matchedSkill.name,
        status: m.status,
        requestDirection,
        lastMessage: lastMessage
          ? {
              content: lastMessage.content,
              createdAt: lastMessage.createdAt.toISOString(),
              senderId: lastMessage.senderId,
            }
          : null,
      };
    });

    const meta = buildPagePaginationMeta(total, page, limit);

    return sendPaginated(res, { conversations }, meta);
  } catch (error) {
    return sendInternalError(res, error, 'Failed to load conversations');
  }
});

export default router;

