import { Router } from 'express';
import { prisma } from '../db/prisma.js';
import { requireSession } from '../middleware/auth.js';
import { getMatchForParticipant, evaluateMessagingEligibility } from '../lib/api-auth.js';
import {
  parseBody,
  parseQuery,
  sendBadRequest,
  sendInternalError,
  sendTooManyRequests,
} from '../lib/api-error.js';
import {
  getMessagesQuerySchema,
  createMessageSchema,
} from '../lib/validators/index.js';
import { rateLimit } from '../lib/rate-limit.js';
import {
  clampLimit,
  buildCursorPaginationMeta,
  sendPaginated,
} from '../lib/pagination.js';

const router = Router();

// GET /api/messages
router.get('/', requireSession, async (req, res) => {
  try {
    const parsedQuery = parseQuery(req.query, getMessagesQuerySchema);
    if (!parsedQuery.success) {
      return res.status(400).json({ error: parsedQuery.error, details: parsedQuery.details });
    }
    const { matchId, cursor } = parsedQuery.data;

    const matchResult = await getMatchForParticipant(res, matchId, req.user.id);
    if (!matchResult) return;

    const limit = clampLimit(parsedQuery.data.limit, 200);

    let cursorMessage = null;
    if (cursor) {
      cursorMessage = await prisma.message.findFirst({
        where: { id: cursor, matchId },
        select: { id: true, createdAt: true },
      });
      if (!cursorMessage) {
        return sendBadRequest(res, 'Invalid cursor: message not found');
      }
    }

    const whereClause = {
      matchId,
      ...(cursorMessage
        ? {
            OR: [
              { createdAt: { lt: cursorMessage.createdAt } },
              {
                createdAt: cursorMessage.createdAt,
                id: { lt: cursorMessage.id },
              },
            ],
          }
        : {}),
    };

    const [total, rawMessages] = await Promise.all([
      prisma.message.count({ where: { matchId } }),
      prisma.message.findMany({
        where: whereClause,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: limit + 1,
        include: {
          sender: {
            select: { id: true, name: true, avatarUrl: true },
          },
        },
      }),
    ]);

    const hasMore = rawMessages.length > limit;
    const pageMessages = hasMore ? rawMessages.slice(0, limit) : rawMessages;
    const nextCursor = hasMore && pageMessages.length > 0 ? pageMessages[pageMessages.length - 1].id : null;

    pageMessages.reverse();

    const formattedMessages = pageMessages.map((m) => ({
      id: m.id,
      matchId: m.matchId,
      senderId: m.senderId,
      senderName: m.sender.name,
      senderAvatar: m.sender.avatarUrl || '',
      content: m.content,
      createdAt: m.createdAt.toISOString(),
    }));

    const meta = buildCursorPaginationMeta(total, limit, nextCursor);

    return sendPaginated(res, { messages: formattedMessages }, meta);
  } catch (error) {
    return sendInternalError(res, error, 'Failed to load messages');
  }
});

// POST /api/messages
router.post('/', requireSession, async (req, res) => {
  try {
    const rl = rateLimit(`messages:create:${req.user.id}`, { limit: 30, windowSeconds: 60 });
    if (!rl.ok) {
      return sendTooManyRequests(res, rl.retryAfterSeconds, rl.limit, rl.remaining);
    }

    const parsed = parseBody(req, createMessageSchema);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error, details: parsed.details });
    }
    const { matchId, content } = parsed.data;

    const matchResult = await getMatchForParticipant(res, matchId, req.user.id);
    if (!matchResult) return;
    const { match } = matchResult;

    // Check messaging eligibility on PENDING and DECLINED matches
    let messageCount = 0;
    if (match.status === 'PENDING') {
      messageCount = await prisma.message.count({
        where: { matchId },
      });
    }

    const eligibility = evaluateMessagingEligibility({
      match,
      senderId: req.user.id,
      messageCount,
    });

    if (!eligibility.allowed) {
      return res.status(eligibility.status).json({ error: eligibility.error });
    }

    const message = await prisma.message.create({
      data: {
        matchId,
        senderId: req.user.id,
        content,
      },
      include: {
        sender: {
          select: { id: true, name: true, avatarUrl: true },
        },
      },
    });

    return res.status(201).json({
      message: {
        id: message.id,
        matchId: message.matchId,
        senderId: message.senderId,
        senderName: message.sender.name,
        senderAvatar: message.sender.avatarUrl || '',
        content: message.content,
        createdAt: message.createdAt.toISOString(),
      },
    });
  } catch (error) {
    return sendInternalError(res, error, 'Failed to send message');
  }
});

export default router;

