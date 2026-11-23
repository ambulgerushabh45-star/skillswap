import config from '../config/env.js';
import { rateLimit } from './rate-limit.js';

let hasLoggedDormantNotice = false;

export function isEmailConfigured() {
  return Boolean(config.RESEND_API_KEY && config.EMAIL_FROM);
}

/**
 * Checks in-memory rate limits for email sending:
 * - Max 5 emails per hour per recipient email
 * - Max 20 emails per 24 hours per recipient email
 */
export function checkEmailRateLimits(recipientEmail) {
  const normalized = String(recipientEmail).trim().toLowerCase();

  const hourly = rateLimit(`email:recipient:1h:${normalized}`, {
    limit: 5,
    windowSeconds: 3600,
  });
  if (!hourly.ok) {
    return { ok: false, reason: 'Recipient hourly email limit reached (5/hr)' };
  }

  const daily = rateLimit(`email:recipient:24h:${normalized}`, {
    limit: 20,
    windowSeconds: 86400,
  });
  if (!daily.ok) {
    return { ok: false, reason: 'Recipient daily email limit reached (20/day)' };
  }

  return { ok: true };
}

/**
 * Checks pair rate limit for connection requests:
 * - Max 1 connection request email per (senderId, recipientId) pair per 24 hours
 */
export function checkConnectionPairLimit(senderId, recipientId) {
  const rl = rateLimit(`email:pair:req:${senderId}:${recipientId}`, {
    limit: 1,
    windowSeconds: 86400,
  });
  return rl.ok;
}

/**
 * Sends transactional email via Resend HTTP API.
 * Never throws into calling route handlers.
 */
export async function sendEmail({ to, subject, text, html }) {
  try {
    if (!isEmailConfigured()) {
      if (!hasLoggedDormantNotice && !config.IS_TEST) {
        hasLoggedDormantNotice = true;
        console.log('[EMAIL] Email notifications are dormant (RESEND_API_KEY or EMAIL_FROM not configured).');
      }
      return { skipped: true };
    }

    // Abuse checks
    const rlCheck = checkEmailRateLimits(to);
    if (!rlCheck.ok) {
      return { skipped: true, reason: rlCheck.reason };
    }

    // Dry Run Mode
    if (config.EMAIL_DRY_RUN) {
      const domain = typeof to === 'string' && to.includes('@') ? to.split('@')[1] : 'unknown';
      console.log(`[EMAIL DRY RUN] Subject: "${subject}" to domain: @${domain}`);
      return { dryRun: true };
    }

    const payload = {
      from: config.EMAIL_FROM,
      to: [to],
      subject,
      text,
      html,
    };

    const res = await fetch(config.RESEND_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.RESEND_API_KEY}`,
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(5000),
    });

    if (!res.ok) {
      console.error(`[EMAIL ERROR] Provider returned HTTP ${res.status}`);
      return { success: false, status: res.status };
    }

    const data = await res.json().catch(() => ({}));
    return { success: true, id: data?.id };
  } catch (err) {
    // Log failure without leaking the recipient email address
    console.error('[EMAIL ERROR] Failed to send email:', err?.message || 'Network error');
    return { success: false, error: 'Failed to send email' };
  }
}

