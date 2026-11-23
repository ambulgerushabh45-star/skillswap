import { Router } from 'express';
import { requireSession } from '../middleware/auth.js';
import { rateLimit } from '../lib/rate-limit.js';
import { parseQuery, sendTooManyRequests } from '../lib/api-error.js';
import { geocodeQuerySchema } from '../lib/validators/index.js';
import { executeGeocodeSearch } from '../lib/geocode.js';

const router = Router();

// GET /api/geocode
router.get('/', requireSession, async (req, res) => {
  try {
    const rl = rateLimit(`geocode:search:${req.user.id}`, {
      limit: 20,
      windowSeconds: 60,
    });
    if (!rl.ok) {
      return sendTooManyRequests(res, rl.retryAfterSeconds, rl.limit, rl.remaining);
    }

    const parsed = parseQuery(req.query, geocodeQuerySchema);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error, details: parsed.details });
    }

    const { results, source } = await executeGeocodeSearch(parsed.data.q);

    res.setHeader('Cache-Control', 'private, no-store');
    res.setHeader('X-Cache', source === 'cache' ? 'HIT' : 'MISS');

    return res.status(200).json({ results });
  } catch (err) {
    console.error('Geocoding service error:', err instanceof Error ? err.message : err);
    res.setHeader('Cache-Control', 'private, no-store');

    return res.status(503).json({
      error: 'Address search is unavailable right now. You can enter coordinates manually.',
    });
  }
});

export default router;

