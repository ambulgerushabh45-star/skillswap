import { Router } from 'express';
import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '../db/prisma.js';
import {
  parseBody,
  sendConflict,
  sendUnauthorized,
  sendInternalError,
  sendTooManyRequests,
} from '../lib/api-error.js';
import { registerSchema } from '../lib/validators/auth.js';
import { rateLimit } from '../lib/rate-limit.js';
import {
  COOKIE_NAME,
  DUMMY_PASSWORD_HASH,
  signSessionToken,
  setSessionCookie,
  clearSessionCookie,
  verifySessionToken,
} from '../lib/auth.js';
import {
  OAUTH_COOKIE_NAME,
  isGoogleOAuthConfigured,
  generatePkcePair,
  signOAuthStateToken,
  verifyOAuthStateToken,
  timingSafeStateCompare,
  setOAuthCookie,
  clearOAuthCookie,
  buildGoogleAuthUrl,
  exchangeGoogleCode,
  fetchGoogleUserInfo,
} from '../lib/oauth.js';

const router = Router();

const loginSchema = z.object({
  email: z
    .string({ message: 'Email is required' })
    .trim()
    .min(1, 'Email is required')
    .email('Invalid email address'),
  password: z
    .string({ message: 'Password is required' })
    .min(1, 'Password is required'),
});

// POST /api/auth/register
router.post('/register', async (req, res) => {
  try {
    const ip = req.ip || req.socket?.remoteAddress || '127.0.0.1';
    // 1. Rate limit: 5 registrations per hour per IP
    const rl = rateLimit(`register:${ip}`, { limit: 5, windowSeconds: 3600 });
    if (!rl.ok) {
      return sendTooManyRequests(res, rl.retryAfterSeconds, rl.limit, rl.remaining);
    }

    // 2. Validate body
    const parsed = parseBody(req, registerSchema);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error, details: parsed.details });
    }

    const { name, email, password } = parsed.data;
    const lowerEmail = email.toLowerCase().trim();

    // 3. Check existing user
    const existingUser = await prisma.user.findUnique({
      where: { email: lowerEmail },
    });

    if (existingUser) {
      return sendConflict(res, 'An account with this email address already exists');
    }

    // Hash password with bcrypt
    const passwordHash = await bcrypt.hash(password, 10);

    const newUser = await prisma.user.create({
      data: {
        name,
        email: lowerEmail,
        passwordHash,
      },
    });

    // Auto-login: sign JWT and set cookie
    const token = signSessionToken(newUser.id);
    setSessionCookie(res, token);

    return res.status(201).json({
      message: 'User registered successfully',
      user: {
        id: newUser.id,
        name: newUser.name,
        email: newUser.email,
      },
    });
  } catch (error) {
    return sendInternalError(
      res,
      error,
      'Something went wrong during registration. Please try again.'
    );
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const ip = req.ip || req.socket?.remoteAddress || '127.0.0.1';

    // 1. Per-IP rate limit: 50 attempts per 15 minutes
    const ipRl = rateLimit(`login:${ip}`, { limit: 50, windowSeconds: 900 });
    if (!ipRl.ok) {
      return sendTooManyRequests(
        res,
        ipRl.retryAfterSeconds,
        ipRl.limit,
        ipRl.remaining,
        `Too many login attempts. Please try again in ${ipRl.retryAfterSeconds} seconds.`
      );
    }

    // 2. Validate body
    const parsed = parseBody(req, loginSchema);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error, details: parsed.details });
    }

    const { email, password } = parsed.data;
    const lowerEmail = email.toLowerCase().trim();

    // 3. Per-IP+Email rate limit: 10 attempts per 15 minutes
    const ipEmailRl = rateLimit(`login:${ip}_${lowerEmail}`, {
      limit: 10,
      windowSeconds: 900,
    });
    if (!ipEmailRl.ok) {
      return sendTooManyRequests(
        res,
        ipEmailRl.retryAfterSeconds,
        ipEmailRl.limit,
        ipEmailRl.remaining,
        `Too many login attempts. Please try again in ${ipEmailRl.retryAfterSeconds} seconds.`
      );
    }

    // 4. Look up user
    const user = await prisma.user.findUnique({
      where: { email: lowerEmail },
    });

    if (!user || !user.passwordHash) {
      // Dummy compare to avoid timing leak
      await bcrypt.compare(password, DUMMY_PASSWORD_HASH);
      return sendUnauthorized(res, 'Invalid email or password');
    }

    const isValid = await bcrypt.compare(password, user.passwordHash);
    if (!isValid) {
      return sendUnauthorized(res, 'Invalid email or password');
    }

    // 5. Sign token and set cookie
    const token = signSessionToken(user.id);
    setSessionCookie(res, token);

    return res.status(200).json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
      },
    });
  } catch (error) {
    return sendInternalError(res, error, 'Something went wrong during login');
  }
});

// POST /api/auth/logout
router.post('/logout', (req, res) => {
  clearSessionCookie(res);
  return res.status(200).json({ message: 'Logged out successfully' });
});

// GET /api/auth/session
router.get('/session', async (req, res) => {
  try {
    const token = req.cookies?.[COOKIE_NAME];
    if (!token) {
      return res.status(200).json({ user: null });
    }

    const decoded = verifySessionToken(token);
    if (!decoded) {
      return res.status(200).json({ user: null });
    }

    const user = await prisma.user.findUnique({
      where: { id: decoded.sub },
      select: {
        id: true,
        name: true,
        email: true,
        avatarUrl: true,
      },
    });

    if (!user) {
      return res.status(200).json({ user: null });
    }

    return res.status(200).json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        image: user.avatarUrl ?? null,
      },
    });
  } catch (error) {
    return sendInternalError(res, error, 'Failed to fetch session');
  }
});

// GET /api/auth/providers
router.get('/providers', (_req, res) => {
  return res.status(200).json({
    google: isGoogleOAuthConfigured(),
  });
});

// GET /api/auth/google
router.get('/google', (req, res) => {
  const ip = req.ip || req.socket?.remoteAddress || '127.0.0.1';
  // Rate limit: 20 per 10 minutes per IP
  const rl = rateLimit(`auth:google:${ip}`, { limit: 20, windowSeconds: 600 });
  if (!rl.ok) {
    return sendTooManyRequests(res, rl.retryAfterSeconds);
  }

  if (!isGoogleOAuthConfigured()) {
    return res.redirect(302, '/auth?error=google_unavailable');
  }

  const { state, codeVerifier, codeChallenge } = generatePkcePair();
  const stateToken = signOAuthStateToken({ state, codeVerifier });

  setOAuthCookie(res, stateToken);

  const authUrl = buildGoogleAuthUrl({ state, codeChallenge });
  return res.redirect(302, authUrl);
});

// GET /api/auth/google/callback
router.get('/google/callback', async (req, res) => {
  // If Google sent an error parameter (e.g. user cancelled consent)
  if (req.query.error) {
    clearOAuthCookie(res);
    return res.redirect(302, '/auth?error=google_cancelled');
  }

  const oauthCookie = req.cookies?.[OAUTH_COOKIE_NAME];
  clearOAuthCookie(res);

  if (!oauthCookie) {
    return res.redirect(302, '/auth?error=google_failed');
  }

  const decoded = verifyOAuthStateToken(oauthCookie);
  if (!decoded) {
    return res.redirect(302, '/auth?error=google_failed');
  }

  const stateParam = typeof req.query.state === 'string' ? req.query.state : '';
  if (!timingSafeStateCompare(stateParam, decoded.state)) {
    return res.redirect(302, '/auth?error=google_failed');
  }

  const code = typeof req.query.code === 'string' ? req.query.code : '';
  if (!code) {
    return res.redirect(302, '/auth?error=google_failed');
  }

  let userInfo;
  try {
    const accessToken = await exchangeGoogleCode({
      code,
      codeVerifier: decoded.codeVerifier,
    });
    userInfo = await fetchGoogleUserInfo(accessToken);
  } catch {
    return res.redirect(302, '/auth?error=google_failed');
  }

  if (!userInfo?.emailVerified || !userInfo.sub || !userInfo.email) {
    return res.redirect(302, '/auth?error=google_failed');
  }

  try {
    // 1. Check if an OAuthAccount for this google sub already exists
    const existingOAuth = await prisma.oAuthAccount.findUnique({
      where: {
        provider_providerAccountId: {
          provider: 'google',
          providerAccountId: userInfo.sub,
        },
      },
      include: { user: true },
    });

    if (existingOAuth?.user) {
      const sessionToken = signSessionToken(existingOAuth.user.id);
      setSessionCookie(res, sessionToken);
      return res.redirect(302, '/dashboard');
    }

    // 2. Check if a User with this email already exists (anti-pre-hijacking)
    const existingUser = await prisma.user.findUnique({
      where: { email: userInfo.email },
    });

    if (existingUser) {
      // Prohibit automatic account linking to prevent account takeovers
      return res.redirect(302, '/auth?error=account_exists');
    }

    // 3. New user registration via Google OAuth
    const displayName =
      userInfo.name || userInfo.email.split('@')[0] || 'User';
    const randomBytes = crypto.randomBytes(48);
    const passwordHash = await bcrypt.hash(randomBytes.toString('hex'), 10);

    const newUser = await prisma.user.create({
      data: {
        name: displayName.slice(0, 100),
        email: userInfo.email,
        passwordHash,
        avatarUrl: null,
        oauthAccounts: {
          create: {
            provider: 'google',
            providerAccountId: userInfo.sub,
          },
        },
      },
    });

    const sessionToken = signSessionToken(newUser.id);
    setSessionCookie(res, sessionToken);
    return res.redirect(302, '/profile/setup');
  } catch {
    return res.redirect(302, '/auth?error=google_failed');
  }
});

export default router;

