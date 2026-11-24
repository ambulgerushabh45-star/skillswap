import { Router } from 'express';
import { prisma } from '../db/prisma.js';
import { requireSession, optionalSession } from '../middleware/auth.js';
import {
  parseBody,
  parseQuery,
  parseParams,
  sendNotFound,
  sendConflict,
  sendInternalError,
  sendTooManyRequests,
} from '../lib/api-error.js';
import {
  createEventSchema,
  patchEventSchema,
  eventIdParamSchema,
  pagePaginationQuerySchema,
} from '../lib/validators/index.js';
import { haversineKm, isValidCoordinate, roundKm } from '../lib/geo.js';
import { rateLimit } from '../lib/rate-limit.js';
import {
  clampLimit,
  buildPagePaginationMeta,
  sendPaginated,
} from '../lib/pagination.js';
import {
  canEditEvent,
  canCancelEvent,
  validateCapacityChange,
  computeIsFull,
} from '../lib/event-rules.js';
import { sendEmail } from '../lib/email.js';
import { buildEventCancelledTemplate } from '../lib/email-templates.js';

const router = Router();

// GET /api/events
router.get('/', optionalSession, async (req, res) => {
  try {
    const parsedQuery = parseQuery(req.query, pagePaginationQuerySchema);
    if (!parsedQuery.success) {
      return res.status(400).json({ error: parsedQuery.error, details: parsedQuery.details });
    }

    const page = parsedQuery.data.page ?? 1;
    const limit = clampLimit(parsedQuery.data.limit, 100);
    const skip = (page - 1) * limit;

    let currentUserId = null;
    let currentUserCoords = null;
    if (req.user?.id) {
      const u = await prisma.user.findUnique({
        where: { id: req.user.id },
        select: { id: true, latitude: true, longitude: true },
      });
      if (u) {
        currentUserId = u.id;
        if (isValidCoordinate(u.latitude, u.longitude)) {
          currentUserCoords = { lat: u.latitude, lng: u.longitude };
        }
      }
    }

    // Cancelled events are only visible to host or RSVP attendees
    const uncancelledCondition = [
      { cancelledAt: null },
      { cancelledAt: { isSet: false } },
    ];

    const where = currentUserId
      ? {
          OR: [
            ...uncancelledCondition,
            { hostId: currentUserId },
            { attendees: { some: { userId: currentUserId } } },
          ],
        }
      : { OR: uncancelledCondition };

    const [total, events] = await Promise.all([
      prisma.event.count({ where }),
      prisma.event.findMany({
        where,
        orderBy: [{ dateTime: 'asc' }, { id: 'asc' }],
        skip,
        take: limit,
        include: {
          host: {
            select: { id: true, name: true, email: true, avatarUrl: true },
          },
          attendees: {
            select: { userId: true, status: true },
          },
        },
      }),
    ]);

    const formattedEvents = events.map((e) => {
      const goingAttendees = e.attendees.filter((a) => a.status === 'GOING');
      const goingCount = goingAttendees.length;
      const isGoing = currentUserId
        ? goingAttendees.some((a) => a.userId === currentUserId)
        : false;
      const isHost = currentUserId ? e.hostId === currentUserId : false;
      const maxAttendees = e.maxAttendees ?? null;
      const cancelled = Boolean(e.cancelledAt);
      const isFull = computeIsFull(goingCount, maxAttendees);

      let distanceKm = null;
      if (currentUserCoords && isValidCoordinate(e.lat, e.lng)) {
        const rawDist = haversineKm(
          currentUserCoords.lat,
          currentUserCoords.lng,
          e.lat,
          e.lng
        );
        distanceKm = roundKm(rawDist, 0.1);
      }

      return {
        id: e.id,
        hostId: e.hostId,
        hostName: e.host.name,
        hostAvatar: e.host.avatarUrl || '',
        title: e.title,
        description: e.description,
        location: e.location,
        lat: e.lat || 12.9716,
        lng: e.lng || 77.5946,
        dateTime: e.dateTime.toISOString(),
        attendeeCount: goingCount,
        goingCount,
        maxAttendees,
        cancelled,
        isFull,
        isGoing,
        isHost,
        distanceKm,
      };
    });

    const meta = buildPagePaginationMeta(total, page, limit);

    return sendPaginated(res, { events: formattedEvents }, meta);
  } catch (error) {
    return sendInternalError(res, error, 'Failed to fetch events');
  }
});

// POST /api/events (Create Event)
router.post('/', requireSession, async (req, res) => {
  try {
    const rl = rateLimit(`events:create:${req.user.id}`, { limit: 10, windowSeconds: 3600 });
    if (!rl.ok) {
      return sendTooManyRequests(res, rl.retryAfterSeconds, rl.limit, rl.remaining);
    }

    const parsed = parseBody(req, createEventSchema);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error, details: parsed.details });
    }

    const { title, description, location, lat, lng, dateTime, maxAttendees } = parsed.data;

    const newEvent = await prisma.event.create({
      data: {
        hostId: req.user.id,
        title,
        description,
        location,
        lat: lat ?? 12.9716,
        lng: lng ?? 77.5946,
        dateTime: new Date(dateTime),
        maxAttendees: maxAttendees ?? null,
        cancelledAt: null,
      },
    });

    await prisma.eventAttendee.create({
      data: {
        eventId: newEvent.id,
        userId: req.user.id,
        status: 'GOING',
      },
    });

    return res.status(201).json({ message: 'Event created successfully!', event: newEvent });
  } catch (error) {
    return sendInternalError(res, error, 'Failed to create event');
  }
});

// PATCH /api/events/:id (Edit Event - P3.5)
router.patch('/:id', requireSession, async (req, res) => {
  try {
    const rl = rateLimit(`events:update:${req.user.id}`, { limit: 30, windowSeconds: 3600 });
    if (!rl.ok) {
      return sendTooManyRequests(res, rl.retryAfterSeconds, rl.limit, rl.remaining);
    }

    const parsedParams = parseParams(req.params, eventIdParamSchema);
    if (!parsedParams.success) {
      return res.status(400).json({ error: parsedParams.error, details: parsedParams.details });
    }
    const { id } = parsedParams.data;

    const parsedBody = parseBody(req, patchEventSchema);
    if (!parsedBody.success) {
      return res.status(400).json({ error: parsedBody.error, details: parsedBody.details });
    }

    const event = await prisma.event.findUnique({
      where: { id },
      include: {
        attendees: {
          where: { status: 'GOING' },
        },
      },
    });

    const editCheck = canEditEvent(event, req.user.id);
    if (!editCheck.allowed) {
      return res.status(editCheck.status).json({ error: editCheck.error });
    }

    if (parsedBody.data.maxAttendees !== undefined) {
      const currentGoingCount = event.attendees.length;
      const capacityCheck = validateCapacityChange(currentGoingCount, parsedBody.data.maxAttendees);
      if (!capacityCheck.valid) {
        return sendConflict(res, capacityCheck.error);
      }
    }

    const updateData = {};
    if (parsedBody.data.title !== undefined) updateData.title = parsedBody.data.title;
    if (parsedBody.data.description !== undefined) updateData.description = parsedBody.data.description;
    if (parsedBody.data.location !== undefined) updateData.location = parsedBody.data.location;
    if (parsedBody.data.dateTime !== undefined) updateData.dateTime = new Date(parsedBody.data.dateTime);
    if (parsedBody.data.lat !== undefined) updateData.lat = parsedBody.data.lat;
    if (parsedBody.data.lng !== undefined) updateData.lng = parsedBody.data.lng;
    if (parsedBody.data.maxAttendees !== undefined) updateData.maxAttendees = parsedBody.data.maxAttendees;

    const updatedEvent = await prisma.event.update({
      where: { id },
      data: updateData,
    });

    return res.status(200).json({
      message: 'Event updated successfully',
      event: updatedEvent,
    });
  } catch (error) {
    return sendInternalError(res, error, 'Failed to update event');
  }
});

// POST /api/events/:id/cancel (Cancel Event - P3.5)
router.post('/:id/cancel', requireSession, async (req, res) => {
  try {
    const rl = rateLimit(`events:cancel:${req.user.id}`, { limit: 10, windowSeconds: 3600 });
    if (!rl.ok) {
      return sendTooManyRequests(res, rl.retryAfterSeconds, rl.limit, rl.remaining);
    }

    const parsedParams = parseParams(req.params, eventIdParamSchema);
    if (!parsedParams.success) {
      return res.status(400).json({ error: parsedParams.error, details: parsedParams.details });
    }
    const { id } = parsedParams.data;

    const event = await prisma.event.findUnique({
      where: { id },
    });

    const cancelCheck = canCancelEvent(event, req.user.id);
    if (!cancelCheck.allowed) {
      return res.status(cancelCheck.status).json({ error: cancelCheck.error });
    }

    await prisma.event.update({
      where: { id },
      data: { cancelledAt: new Date() },
    });

    // Fire-and-forget: notify attendees with status GOING (except host, capped at 50)
    (async () => {
      try {
        const [attendees, host] = await Promise.all([
          prisma.eventAttendee.findMany({
            where: {
              eventId: id,
              status: 'GOING',
              userId: { not: req.user.id },
            },
            take: 50,
            include: {
              user: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                  emailNotifications: true,
                },
              },
            },
          }),
          prisma.user.findUnique({
            where: { id: req.user.id },
            select: { name: true },
          }),
        ]);

        for (const att of attendees) {
          if (att.user && att.user.emailNotifications !== false) {
            const template = buildEventCancelledTemplate({
              attendeeName: att.user.name,
              eventTitle: event.title,
              hostName: host?.name || 'The host',
            });
            await sendEmail({
              to: att.user.email,
              subject: template.subject,
              text: template.text,
              html: template.html,
            });
          }
        }
      } catch {
        // ignore background email failure
      }
    })();

    return res.status(200).json({ message: 'Event cancelled successfully' });
  } catch (error) {
    return sendInternalError(res, error, 'Failed to cancel event');
  }
});

const eventLocks = new Map();

function withEventLock(eventId, fn) {
  const prev = eventLocks.get(eventId) || Promise.resolve();
  let resolveCurrent;
  const current = new Promise((resolve) => {
    resolveCurrent = resolve;
  });
  eventLocks.set(eventId, current);
  return prev
    .then(fn)
    .finally(() => {
      resolveCurrent();
      if (eventLocks.get(eventId) === current) {
        eventLocks.delete(eventId);
      }
    });
}

// POST /api/events/:id/rsvp (RSVP with Capacity & Cancel Checks - P3.5)
router.post('/:id/rsvp', requireSession, async (req, res) => {
  try {
    const rl = rateLimit(`events:rsvp:${req.user.id}`, { limit: 60, windowSeconds: 3600 });
    if (!rl.ok) {
      return sendTooManyRequests(res, rl.retryAfterSeconds, rl.limit, rl.remaining);
    }

    const parsedParams = parseParams(req.params, eventIdParamSchema);
    if (!parsedParams.success) {
      return res.status(400).json({ error: parsedParams.error, details: parsedParams.details });
    }
    const { id: eventId } = parsedParams.data;

    return await withEventLock(eventId, async () => {
      const event = await prisma.event.findUnique({
        where: { id: eventId },
        select: { id: true, hostId: true, maxAttendees: true, cancelledAt: true },
      });

      if (!event) {
        return sendNotFound(res, 'Event not found');
      }

      if (event.cancelledAt) {
        return sendConflict(res, 'This event has been cancelled.');
      }

      const existing = await prisma.eventAttendee.findUnique({
        where: {
          eventId_userId: {
            eventId,
            userId: req.user.id,
          },
        },
      });

      if (existing && existing.status === 'GOING') {
        // Toggle to CANCELLED — always allowed, never blocked by capacity
        await prisma.eventAttendee.update({
          where: { id: existing.id },
          data: { status: 'CANCELLED' },
        });
        return res.status(200).json({ message: 'RSVP cancelled', isGoing: false });
      }

      // Pre-check capacity before write
      if (event.maxAttendees !== null) {
        const currentGoing = await prisma.eventAttendee.count({
          where: { eventId, status: 'GOING' },
        });
        if (currentGoing >= event.maxAttendees) {
          return sendConflict(res, 'This event is full.');
        }
      }

      // Joining as GOING — insert or update
      let attendee;
      if (existing) {
        attendee = await prisma.eventAttendee.update({
          where: { id: existing.id },
          data: { status: 'GOING' },
        });
      } else {
        attendee = await prisma.eventAttendee.create({
          data: {
            eventId,
            userId: req.user.id,
            status: 'GOING',
          },
        });
      }

      // Post-write recount with deterministic compensation under concurrency
      if (event.maxAttendees !== null) {
        const allGoing = await prisma.eventAttendee.findMany({
          where: { eventId, status: 'GOING' },
          select: { id: true, userId: true },
        });

        if (allGoing.length > event.maxAttendees) {
          // Deterministic priority: host always first, then lowest attendee IDs
          const sorted = allGoing.sort((a, b) => {
            if (a.userId === event.hostId) return -1;
            if (b.userId === event.hostId) return 1;
            return a.id.localeCompare(b.id);
          });
          const allowedIds = new Set(sorted.slice(0, event.maxAttendees).map((a) => a.id));

          if (!allowedIds.has(attendee.id)) {
            // Revert/compensate oversubscribed attendee
            if (existing) {
              await prisma.eventAttendee.update({
                where: { id: existing.id },
                data: { status: existing.status },
              });
            } else {
              await prisma.eventAttendee.delete({
                where: { id: attendee.id },
              });
            }
            return sendConflict(res, 'This event is full.');
          }
        }
      }

      return res.status(200).json({ message: 'RSVP confirmed!', isGoing: true });
    });
  } catch (error) {
    return sendInternalError(res, error, 'Failed to update RSVP');
  }
});

export default router;

