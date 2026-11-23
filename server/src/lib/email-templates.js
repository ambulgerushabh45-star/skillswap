import config from '../config/env.js';

/**
 * Escapes dynamic strings for HTML injection protection.
 */
export function escapeHtml(str) {
  if (typeof str !== 'string') return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Strips carriage returns and newlines to prevent email header injection.
 * Caps subject line at 100 characters.
 */
export function sanitizeSubject(subject) {
  if (typeof subject !== 'string') return '';
  return subject.replace(/[\r\n]+/g, ' ').trim().slice(0, 100);
}

function getEmailFooterText() {
  const settingsUrl = `${config.PUBLIC_URL}/profile/setup`;
  return [
    '---',
    'You are receiving this transactional email because you have a SkillSwap account.',
    'If you did not create a SkillSwap account you can ignore this message.',
    `To adjust your email notification preferences, visit: ${settingsUrl}`,
  ].join('\n');
}

function getEmailFooterHtml() {
  const settingsUrl = `${config.PUBLIC_URL}/profile/setup`;
  return `
    <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
    <p style="font-size: 12px; color: #64748b; line-height: 1.5; margin: 0 0 8px 0;">
      You are receiving this transactional email because you have a SkillSwap account.
      If you did not create a SkillSwap account you can ignore this message.
    </p>
    <p style="font-size: 12px; color: #64748b; margin: 0;">
      To adjust email notification preferences, <a href="${escapeHtml(settingsUrl)}" style="color: #4f46e5; text-decoration: underline;">visit profile settings</a>.
    </p>
  `;
}

/**
 * Template: New Connection Request
 */
export function buildNewConnectionRequestTemplate({
  recipientName = 'there',
  requesterName = 'A user',
  skillName = 'a skill',
  matchId,
}) {
  const safeRecipient = escapeHtml(recipientName);
  const safeRequester = escapeHtml(requesterName);
  const safeSkill = escapeHtml(skillName);

  const subject = sanitizeSubject(`New connection request from ${requesterName} on SkillSwap`);
  const chatUrl = matchId ? `${config.PUBLIC_URL}/chat?matchId=${encodeURIComponent(matchId)}` : `${config.PUBLIC_URL}/dashboard`;

  const text = [
    `Hi ${recipientName},`,
    '',
    `${requesterName} wants to connect with you on SkillSwap to trade skills (${skillName}).`,
    '',
    `Review this request and respond here: ${chatUrl}`,
    '',
    getEmailFooterText(),
  ].join('\n');

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #1e293b;">
      <h2 style="font-size: 20px; font-weight: 700; color: #0f172a; margin-top: 0;">New Connection Request</h2>
      <p style="font-size: 14px; line-height: 1.6;">Hi ${safeRecipient},</p>
      <p style="font-size: 14px; line-height: 1.6;">
        <strong>${safeRequester}</strong> wants to connect with you on SkillSwap to trade <strong>${safeSkill}</strong>.
      </p>
      <div style="margin: 24px 0;">
        <a href="${escapeHtml(chatUrl)}" style="background-color: #4f46e5; color: #ffffff; padding: 10px 20px; text-decoration: none; border-radius: 6px; font-size: 14px; font-weight: 600; display: inline-block;">
          View Request
        </a>
      </div>
      ${getEmailFooterHtml()}
    </div>
  `;

  return { subject, text, html };
}

/**
 * Template: Connection Request Accepted
 */
export function buildConnectionAcceptedTemplate({
  requesterName = 'there',
  recipientName = 'Your peer',
  skillName = 'a skill',
  matchId,
}) {
  const safeRequester = escapeHtml(requesterName);
  const safeRecipient = escapeHtml(recipientName);
  const safeSkill = escapeHtml(skillName);

  const subject = sanitizeSubject(`${recipientName} accepted your connection request on SkillSwap`);
  const chatUrl = matchId ? `${config.PUBLIC_URL}/chat?matchId=${encodeURIComponent(matchId)}` : `${config.PUBLIC_URL}/dashboard`;

  const text = [
    `Hi ${requesterName},`,
    '',
    `Great news! ${recipientName} accepted your connection request to trade skills (${skillName}).`,
    '',
    `You can now coordinate your skill swap session in chat: ${chatUrl}`,
    '',
    getEmailFooterText(),
  ].join('\n');

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #1e293b;">
      <h2 style="font-size: 20px; font-weight: 700; color: #0f172a; margin-top: 0;">Connection Request Accepted</h2>
      <p style="font-size: 14px; line-height: 1.6;">Hi ${safeRequester},</p>
      <p style="font-size: 14px; line-height: 1.6;">
        Great news! <strong>${safeRecipient}</strong> accepted your connection request to trade <strong>${safeSkill}</strong>.
      </p>
      <div style="margin: 24px 0;">
        <a href="${escapeHtml(chatUrl)}" style="background-color: #4f46e5; color: #ffffff; padding: 10px 20px; text-decoration: none; border-radius: 6px; font-size: 14px; font-weight: 600; display: inline-block;">
          Open Chat
        </a>
      </div>
      ${getEmailFooterHtml()}
    </div>
  `;

  return { subject, text, html };
}

/**
 * Template: Event Cancelled
 */
export function buildEventCancelledTemplate({
  attendeeName = 'there',
  eventTitle = 'An event',
  hostName = 'The host',
}) {
  const safeAttendee = escapeHtml(attendeeName);
  const safeTitle = escapeHtml(eventTitle);
  const safeHost = escapeHtml(hostName);

  const subject = sanitizeSubject(`Event Cancelled: ${eventTitle}`);
  const eventsUrl = `${config.PUBLIC_URL}/events`;

  const text = [
    `Hi ${attendeeName},`,
    '',
    `The event "${eventTitle}" hosted by ${hostName} has been cancelled.`,
    '',
    `You can browse upcoming skill swap workshops and events here: ${eventsUrl}`,
    '',
    getEmailFooterText(),
  ].join('\n');

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #1e293b;">
      <h2 style="font-size: 20px; font-weight: 700; color: #dc2626; margin-top: 0;">Event Cancelled</h2>
      <p style="font-size: 14px; line-height: 1.6;">Hi ${safeAttendee},</p>
      <p style="font-size: 14px; line-height: 1.6;">
        The event <strong>&ldquo;${safeTitle}&rdquo;</strong> hosted by <strong>${safeHost}</strong> has been cancelled.
      </p>
      <div style="margin: 24px 0;">
        <a href="${escapeHtml(eventsUrl)}" style="background-color: #4f46e5; color: #ffffff; padding: 10px 20px; text-decoration: none; border-radius: 6px; font-size: 14px; font-weight: 600; display: inline-block;">
          Browse Other Events
        </a>
      </div>
      ${getEmailFooterHtml()}
    </div>
  `;

  return { subject, text, html };
}

