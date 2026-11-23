import { Router } from 'express';
import { prisma } from '../db/prisma.js';
import { requireSession } from '../middleware/auth.js';
import {
  parseBody,
  sendInternalError,
  sendTooManyRequests,
} from '../lib/api-error.js';
import { createSkillSchema } from '../lib/validators/skills.js';
import { rateLimit } from '../lib/rate-limit.js';

const router = Router();

const DEFAULT_SKILLS = [
  { name: 'JavaScript / React', category: 'Programming' },
  { name: 'Python / Data Science', category: 'Programming' },
  { name: 'UI/UX Design (Figma)', category: 'Design' },
  { name: 'Spanish Conversation', category: 'Languages' },
  { name: 'Acoustic Guitar', category: 'Music' },
  { name: 'Italian Cooking', category: 'Culinary' },
  { name: 'Digital Photography', category: 'Arts' },
  { name: 'Public Speaking', category: 'Personal Growth' },
  { name: 'Chess Strategy', category: 'Games' },
  { name: 'Fitness & Yoga', category: 'Health' },
];

// GET /api/skills
router.get('/', async (req, res) => {
  try {
    let skills = await prisma.skill.findMany({
      orderBy: { name: 'asc' },
    });

    if (skills.length === 0) {
      for (const item of DEFAULT_SKILLS) {
        await prisma.skill.create({ data: item });
      }

      skills = await prisma.skill.findMany({
        orderBy: { name: 'asc' },
      });
    }

    return res.status(200).json({ skills });
  } catch (error) {
    return sendInternalError(res, error, 'Failed to fetch skills');
  }
});

// POST /api/skills
router.post('/', requireSession, async (req, res) => {
  try {
    // 1. Rate limit: 20 skills per hour per user
    const rl = rateLimit(`skills:create:${req.user.id}`, {
      limit: 20,
      windowSeconds: 3600,
    });
    if (!rl.ok) {
      return sendTooManyRequests(res, rl.retryAfterSeconds, rl.limit, rl.remaining);
    }

    // 2. Validate body
    const parsed = parseBody(req, createSkillSchema);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error, details: parsed.details });
    }

    const { name, category } = parsed.data;

    // 3. Upsert skill
    const skill = await prisma.skill.upsert({
      where: { name },
      update: {},
      create: {
        name,
        category,
      },
    });

    return res.status(201).json({ skill });
  } catch (error) {
    return sendInternalError(res, error, 'Failed to create skill');
  }
});

export default router;

