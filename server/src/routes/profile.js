import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { prisma } from '../db/prisma.js';
import { requireSession } from '../middleware/auth.js';
import { clearSessionCookie } from '../lib/auth.js';
import { avatarStorage } from '../lib/avatar-storage.js';
import {
  parseBody,
  sendBadRequest,
  sendNotFound,
  sendInternalError,
  sendTooManyRequests,
} from '../lib/api-error.js';
import {
  updateProfileSchema,
  deleteAccountSchema,
} from '../lib/validators/profile.js';
import { rateLimit } from '../lib/rate-limit.js';

const router = Router();

export const SAFE_PROFILE_SELECT = {
  id: true,
  name: true,
  email: true,
  bio: true,
  location: true,
  latitude: true,
  longitude: true,
  avatarUrl: true,
  emailNotifications: true,
  createdAt: true,
  updatedAt: true,
  skillsTeach: {
    include: { skill: true },
  },
  skillsLearn: {
    include: { skill: true },
  },
  oauthAccounts: {
    select: { provider: true },
  },
};

function formatUserProfile(user) {
  if (!user) return null;
  const authMethod = user.oauthAccounts && user.oauthAccounts.length > 0 ? 'google' : 'password';
  const emailNotifications =
    user.emailNotifications !== null && user.emailNotifications !== undefined
      ? Boolean(user.emailNotifications)
      : true;

  const { oauthAccounts: _oauthAccounts, ...rest } = user;
  return {
    ...rest,
    authMethod,
    emailNotifications,
  };
}

// GET /api/user/profile
router.get('/profile', requireSession, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: SAFE_PROFILE_SELECT,
    });

    if (!user) {
      return sendNotFound(res, 'User not found');
    }

    return res.status(200).json({ user: formatUserProfile(user) });
  } catch (error) {
    return sendInternalError(res, error, 'Failed to load profile');
  }
});

// PUT /api/user/profile
router.put('/profile', requireSession, async (req, res) => {
  try {
    // 1. Rate limit: 30 profile updates per hour per user
    const rl = rateLimit(`profile:update:${req.user.id}`, {
      limit: 30,
      windowSeconds: 3600,
    });
    if (!rl.ok) {
      return sendTooManyRequests(res, rl.retryAfterSeconds, rl.limit, rl.remaining);
    }

    // 2. Validate body
    const parsed = parseBody(req, updateProfileSchema);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error, details: parsed.details });
    }

    const {
      bio,
      location,
      latitude,
      longitude,
      avatarUrl,
      skillsTeach,
      skillsLearn,
      emailNotifications,
    } = parsed.data;

    // 3. Caller avatar ownership check: /api/avatars/ must belong to auth user
    if (avatarUrl && avatarUrl.startsWith('/api/avatars/')) {
      const fileName = avatarUrl.slice('/api/avatars/'.length);
      if (!fileName.startsWith(`${req.user.id}-`)) {
        return sendBadRequest(res, "Cannot use another user's avatar");
      }
    }

    // 4. Update basic user info strictly for the session user
    const updatedUser = await prisma.user.update({
      where: { id: req.user.id },
      data: {
        bio: bio !== undefined ? bio || null : undefined,
        location: location !== undefined ? location || null : undefined,
        latitude: latitude !== undefined ? latitude : undefined,
        longitude: longitude !== undefined ? longitude : undefined,
        avatarUrl: avatarUrl !== undefined ? avatarUrl || null : undefined,
        emailNotifications: emailNotifications !== undefined ? emailNotifications : undefined,
      },
    });

    // 5. Update skills to teach if provided
    if (Array.isArray(skillsTeach)) {
      await prisma.userSkillsTeach.deleteMany({
        where: { userId: updatedUser.id },
      });

      for (const item of skillsTeach) {
        const skill = await prisma.skill.upsert({
          where: { name: item.name },
          update: {},
          create: { name: item.name, category: item.category || 'General' },
        });

        await prisma.userSkillsTeach.create({
          data: {
            userId: updatedUser.id,
            skillId: skill.id,
            proficiency: item.proficiency,
          },
        });
      }
    }

    // 6. Update skills to learn if provided
    if (Array.isArray(skillsLearn)) {
      await prisma.userSkillsLearn.deleteMany({
        where: { userId: updatedUser.id },
      });

      for (const item of skillsLearn) {
        const skill = await prisma.skill.upsert({
          where: { name: item.name },
          update: {},
          create: { name: item.name, category: item.category || 'General' },
        });

        await prisma.userSkillsLearn.create({
          data: {
            userId: updatedUser.id,
            skillId: skill.id,
          },
        });
      }
    }

    // 7. Fetch full updated user
    const fullUser = await prisma.user.findUnique({
      where: { id: updatedUser.id },
      select: SAFE_PROFILE_SELECT,
    });

    return res.status(200).json({
      message: 'Profile updated successfully',
      user: formatUserProfile(fullUser),
    });
  } catch (error) {
    return sendInternalError(res, error, 'Failed to update profile');
  }
});

// DELETE /api/user/account
router.delete('/account', requireSession, async (req, res) => {
  try {
    // 1. Rate limit: 3 per hour per user
    const rl = rateLimit(`account:delete:${req.user.id}`, {
      limit: 3,
      windowSeconds: 3600,
    });
    if (!rl.ok) {
      return sendTooManyRequests(res, rl.retryAfterSeconds, rl.limit, rl.remaining);
    }

    // 2. Validate request body
    const parsed = parseBody(req, deleteAccountSchema);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error, details: parsed.details });
    }

    // 3. Find user and check auth method
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      include: { oauthAccounts: true },
    });

    if (!user) {
      return sendNotFound(res, 'User not found');
    }

    const hasOAuth = user.oauthAccounts && user.oauthAccounts.length > 0;
    if (!hasOAuth) {
      if (!parsed.data.password) {
        return sendBadRequest(res, 'Password is required to delete password account');
      }
      const isMatch = await bcrypt.compare(parsed.data.password, user.passwordHash || '');
      if (!isMatch) {
        return res.status(403).json({ error: 'Invalid password' });
      }
    }

    const uid = user.id;

    // 4. Cascade cleanup in explicit dependency order

    // 4.1 Hosted events and their attendees
    const hostedEvents = await prisma.event.findMany({
      where: { hostId: uid },
      select: { id: true },
    });
    if (hostedEvents.length > 0) {
      const eventIds = hostedEvents.map((e) => e.id);
      await prisma.eventAttendee.deleteMany({
        where: { eventId: { in: eventIds } },
      });
      await prisma.event.deleteMany({
        where: { id: { in: eventIds } },
      });
    }

    // 4.2 User's attendances to other events
    await prisma.eventAttendee.deleteMany({
      where: { userId: uid },
    });

    // 4.3 User's matches and their messages
    const matches = await prisma.match.findMany({
      where: { OR: [{ userAId: uid }, { userBId: uid }] },
      select: { id: true },
    });
    if (matches.length > 0) {
      const matchIds = matches.map((m) => m.id);
      await prisma.message.deleteMany({
        where: { matchId: { in: matchIds } },
      });
      await prisma.match.deleteMany({
        where: { id: { in: matchIds } },
      });
    }

    // 4.4 Any messages sent by user elsewhere
    await prisma.message.deleteMany({
      where: { senderId: uid },
    });

    // 4.5 Reviews given and received
    await prisma.review.deleteMany({
      where: { OR: [{ fromUserId: uid }, { toUserId: uid }] },
    });

    // 4.6 User skills
    await prisma.userSkillsTeach.deleteMany({
      where: { userId: uid },
    });
    await prisma.userSkillsLearn.deleteMany({
      where: { userId: uid },
    });

    // 4.7 OAuth accounts
    await prisma.oAuthAccount.deleteMany({
      where: { userId: uid },
    });

    // 4.8 Avatar files (database and disk)
    const avatars = await prisma.avatarFile.findMany({
      where: { userId: uid },
      select: { id: true },
    });
    for (const a of avatars) {
      try {
        await avatarStorage.delete(a.id);
      } catch {
        // ignore
      }
    }
    await prisma.avatarFile.deleteMany({
      where: { userId: uid },
    });

    // 4.9 User document
    await prisma.user.delete({
      where: { id: uid },
    });

    // 5. Clear session cookie
    clearSessionCookie(res);

    return res.status(200).json({ message: 'Account successfully deleted' });
  } catch (error) {
    return sendInternalError(res, error, 'Failed to delete account');
  }
});

export default router;
