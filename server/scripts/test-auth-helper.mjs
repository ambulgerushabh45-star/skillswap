import { prisma } from '../src/db/prisma.js';
import { signSessionToken } from '../src/lib/auth.js';

export const DEFAULT_BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:4000';

export async function login(email, password = 'password123', baseUrl = DEFAULT_BASE_URL) {
  try {
    const res = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    if (res.ok) {
      const setCookie = res.headers.get('set-cookie');
      const match = setCookie?.match(/skillswap_session=([^;]+)/);
      if (match) return `skillswap_session=${match[1]}`;
    }
  } catch {
    // Fall back to signing token directly via database lookup
  }

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true },
  });

  if (!user) {
    throw new Error(`User not found: ${email}`);
  }

  const token = signSessionToken(user.id);
  return `skillswap_session=${token}`;
}

export function getSessionCookie(userId) {
  const token = signSessionToken(userId);
  return `skillswap_session=${token}`;
}

