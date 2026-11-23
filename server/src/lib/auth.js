import jwt from 'jsonwebtoken';
import config from '../config/env.js';

export const COOKIE_NAME = 'skillswap_session';
export const SESSION_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

// Dummy bcrypt hash for constant-time comparison when email not found
export const DUMMY_PASSWORD_HASH =
  '$2b$10$wVuJt2Uihj5475xulS3KRugSEnrGJbD6yUxfU5Jjb78hn.FFOd3fq';

export function getSessionCookieOptions() {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: config.IS_PRODUCTION,
    path: '/',
    maxAge: SESSION_MAX_AGE_MS,
  };
}

export function signSessionToken(userId, options = {}) {
  return jwt.sign(
    { sub: userId },
    config.JWT_SECRET,
    {
      algorithm: 'HS256',
      expiresIn: options.expiresIn ?? '7d',
    }
  );
}

export function verifySessionToken(token) {
  if (!token || typeof token !== 'string') return null;
  try {
    const decoded = jwt.verify(token, config.JWT_SECRET, {
      algorithms: ['HS256'],
    });
    if (!decoded || typeof decoded !== 'object' || !decoded.sub) {
      return null;
    }
    return decoded;
  } catch {
    return null;
  }
}

export function setSessionCookie(res, token) {
  res.cookie(COOKIE_NAME, token, getSessionCookieOptions());
}

export function clearSessionCookie(res) {
  res.clearCookie(COOKIE_NAME, {
    httpOnly: true,
    sameSite: 'lax',
    secure: config.IS_PRODUCTION,
    path: '/',
  });
}
