import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import config from '../config/env.js';

export const OAUTH_COOKIE_NAME = 'skillswap_oauth';
export const OAUTH_COOKIE_MAX_AGE_MS = 10 * 60 * 1000; // 10 minutes

export function isGoogleOAuthConfigured() {
  return Boolean(config.GOOGLE_CLIENT_ID && config.GOOGLE_CLIENT_SECRET);
}

export function getOAuthCookieOptions() {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: config.IS_PRODUCTION,
    path: '/api/auth/google',
    maxAge: OAUTH_COOKIE_MAX_AGE_MS,
  };
}

export function generatePkcePair() {
  const codeVerifier = crypto.randomBytes(32).toString('base64url');
  const codeChallenge = crypto
    .createHash('sha256')
    .update(codeVerifier)
    .digest('base64url');
  const state = crypto.randomBytes(32).toString('base64url');

  return { state, codeVerifier, codeChallenge };
}

export function signOAuthStateToken({ state, codeVerifier }) {
  return jwt.sign({ state, codeVerifier }, config.JWT_SECRET, {
    algorithm: 'HS256',
    expiresIn: '10m',
  });
}

export function verifyOAuthStateToken(token) {
  if (!token || typeof token !== 'string') return null;
  try {
    const decoded = jwt.verify(token, config.JWT_SECRET, {
      algorithms: ['HS256'],
    });
    if (!decoded || typeof decoded !== 'object' || !decoded.state || !decoded.codeVerifier) {
      return null;
    }
    return decoded;
  } catch {
    return null;
  }
}

export function timingSafeStateCompare(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

export function setOAuthCookie(res, token) {
  res.cookie(OAUTH_COOKIE_NAME, token, getOAuthCookieOptions());
}

export function clearOAuthCookie(res) {
  res.clearCookie(OAUTH_COOKIE_NAME, {
    httpOnly: true,
    sameSite: 'lax',
    secure: config.IS_PRODUCTION,
    path: '/api/auth/google',
  });
}

export function buildGoogleAuthUrl({ state, codeChallenge }) {
  const redirectUri = `${config.PUBLIC_URL}/api/auth/google/callback`;
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: config.GOOGLE_CLIENT_ID,
    redirect_uri: redirectUri,
    scope: 'openid email profile',
    state,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
    prompt: 'select_account',
  });
  return `${config.GOOGLE_AUTH_URL}?${params.toString()}`;
}

export async function exchangeGoogleCode({ code, codeVerifier }) {
  const redirectUri = `${config.PUBLIC_URL}/api/auth/google/callback`;
  const body = new URLSearchParams({
    code,
    client_id: config.GOOGLE_CLIENT_ID,
    client_secret: config.GOOGLE_CLIENT_SECRET,
    redirect_uri: redirectUri,
    grant_type: 'authorization_code',
    code_verifier: codeVerifier,
  });

  const res = await fetch(config.GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
    signal: AbortSignal.timeout(5000),
  });

  if (!res.ok) {
    throw new Error(`Token exchange failed with status ${res.status}`);
  }

  const data = await res.json();
  if (!data?.access_token) {
    throw new Error('Missing access token in token exchange response');
  }

  return data.access_token;
}

export async function fetchGoogleUserInfo(accessToken) {
  const res = await fetch(config.GOOGLE_USERINFO_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
    signal: AbortSignal.timeout(5000),
  });

  if (!res.ok) {
    throw new Error(`Userinfo request failed with status ${res.status}`);
  }

  const data = await res.json();
  if (!data?.sub || !data?.email) {
    throw new Error('Userinfo response missing required sub or email');
  }

  return {
    sub: String(data.sub),
    email: String(data.email).trim().toLowerCase(),
    emailVerified: data.email_verified === true,
    name: data.name ? String(data.name).trim().slice(0, 100) : '',
  };
}

