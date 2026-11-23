import { COOKIE_NAME, verifySessionToken } from '../lib/auth.js';
import { sendUnauthorized } from '../lib/api-error.js';

export function requireSession(req, res, next) {
  const token = req.cookies?.[COOKIE_NAME];
  if (!token) {
    return sendUnauthorized(res, 'Unauthorized');
  }

  const decoded = verifySessionToken(token);
  if (!decoded) {
    return sendUnauthorized(res, 'Unauthorized');
  }

  req.user = { id: decoded.sub };
  return next();
}

export function optionalSession(req, res, next) {
  const token = req.cookies?.[COOKIE_NAME];
  if (token) {
    const decoded = verifySessionToken(token);
    if (decoded) {
      req.user = { id: decoded.sub };
      return next();
    }
  }
  req.user = null;
  return next();
}

