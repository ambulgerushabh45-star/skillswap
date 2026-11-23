import config from '../config/env.js';
import { sendForbidden } from '../lib/api-error.js';

const STATE_CHANGING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/**
 * CSRF Protection via Origin header verification.
 * For state-changing methods (POST, PUT, PATCH, DELETE):
 * - If an Origin header is present, it MUST match one of the ALLOWED_ORIGINS.
 * - If the Origin is unknown / foreign, reject with 403 { "error": "Invalid origin" }.
 * - Requests without an Origin header (such as curl, server-to-server, or same-origin top-level navigations) are allowed.
 */
export function csrfOriginCheck(req, res, next) {
  if (!STATE_CHANGING_METHODS.has(req.method)) {
    return next();
  }

  // Reject cross-site requests indicated by browser Sec-Fetch-Site header
  const secFetchSite = req.headers['sec-fetch-site'];
  if (secFetchSite === 'cross-site') {
    return sendForbidden(res, 'Cross-site request blocked');
  }

  const origin = req.headers['origin'];
  if (!origin) {
    // Requests without Origin header are allowed
    return next();
  }

  // Normalize origin (remove trailing slash)
  const normalizedOrigin = origin.replace(/\/+$/, '');
  const isAllowed = config.ALLOWED_ORIGINS.some(
    (allowed) => allowed.replace(/\/+$/, '') === normalizedOrigin
  );

  if (!isAllowed) {
    return sendForbidden(res, 'Invalid origin');
  }

  return next();
}

export default csrfOriginCheck;

