// server/scripts/security2-check.mjs
// Phase 6 Security & Abuse Hardening Verification Script
// Tests NoSQL object injection, array query params, PENDING/DECLINED messaging rules,
// Sec-Fetch-Site cross-site CSRF rejection, unauthenticated reviews rejection, and security headers.

import { login, DEFAULT_BASE_URL } from './test-auth-helper.mjs';

const BASE_URL = process.env.TEST_BASE_URL || DEFAULT_BASE_URL;

let passed = 0;
let failed = 0;

function assert(condition, message, detail = '') {
  if (condition) {
    passed++;
    console.log(`  ✓ ${message}${detail ? ` (${detail})` : ''}`);
  } else {
    failed++;
    console.error(`  ✗ FAIL: ${message}${detail ? ` (${detail})` : ''}`);
  }
}

async function runSecurity2Checks() {
  console.log(`======================================================`);
  console.log(`Starting Phase 6 Security & Abuse Checks on ${BASE_URL}`);
  console.log(`======================================================\n`);

  // Section 1: NoSQL / Object Injection & Type Validation
  console.log('--- 1. Object Injection & Type Mismatch Rejections (400) ---');
  
  // 1.1 Login with object in email/password
  const objLoginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: { $ne: '' }, password: { $ne: '' } }),
  });
  assert(objLoginRes.status === 400, 'Login with object-injection payload rejected with 400 Bad Request', `Got ${objLoginRes.status}`);

  // 1.2 Register with object in name/email
  const objRegRes = await fetch(`${BASE_URL}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: { $ne: '' }, email: { $ne: '' }, password: 'password123' }),
  });
  assert(objRegRes.status === 400, 'Register with object-injection payload rejected with 400 Bad Request', `Got ${objRegRes.status}`);

  // Authenticate test users
  const alexCookie = await login('alex@example.com', 'password123', BASE_URL);
  const aaravCookie = await login('aarav.sharma@example.com', 'password123', BASE_URL);

  // Section 2: Array Query Parameter Pollution Rejections (400)
  console.log('\n--- 2. Array Query Parameter Rejections (400) ---');
  const arrMatchQueryRes = await fetch(`${BASE_URL}/api/messages?matchId=id1&matchId=id2`, {
    headers: { Cookie: alexCookie },
  });
  assert(arrMatchQueryRes.status === 400, 'GET /api/messages with array query parameter rejected with 400 Bad Request', `Got ${arrMatchQueryRes.status}`);

  const arrReviewQueryRes = await fetch(`${BASE_URL}/api/reviews?toUserId=user1&toUserId=user2`, {
    headers: { Cookie: alexCookie },
  });
  assert(arrReviewQueryRes.status === 400, 'GET /api/reviews with array query parameter rejected with 400 Bad Request', `Got ${arrReviewQueryRes.status}`);

  // Section 3: Reviews Route Session Protection (401)
  console.log('\n--- 3. Protected GET /api/reviews (401) ---');
  const unauthReviewsRes = await fetch(`${BASE_URL}/api/reviews?toUserId=any-user-id`);
  assert(unauthReviewsRes.status === 401, 'Unauthenticated GET /api/reviews rejected with 401 Unauthorized', `Got ${unauthReviewsRes.status}`);

  // Section 4: Cross-Site Sec-Fetch-Site CSRF Rejection (403)
  console.log('\n--- 4. Cross-Site Sec-Fetch-Site Request Rejection (403) ---');
  const crossSiteRes = await fetch(`${BASE_URL}/api/matches`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: alexCookie,
      'Sec-Fetch-Site': 'cross-site',
    },
    body: JSON.stringify({ targetUserId: 'dummy' }),
  });
  assert(crossSiteRes.status === 403, 'State-changing request with Sec-Fetch-Site: cross-site rejected with 403 Forbidden', `Got ${crossSiteRes.status}`);

  // Section 5: Messaging Abuse Rules on PENDING and DECLINED Matches (409)
  console.log('\n--- 5. Messaging Abuse Rules on PENDING & DECLINED Matches (409) ---');

  // Find Aarav's user ID
  const aaravProfileRes = await fetch(`${BASE_URL}/api/user/profile`, { headers: { Cookie: aaravCookie } });
  const aaravProfile = await aaravProfileRes.json();
  const aaravId = aaravProfile.user.id;

  // Alex sends a connection request to Aarav
  const connectRes = await fetch(`${BASE_URL}/api/matches`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: alexCookie },
    body: JSON.stringify({ targetUserId: aaravId }),
  });
  const connectData = await connectRes.json();
  const pendingMatchId = connectData.match?.id;
  assert(connectRes.status === 201 && Boolean(pendingMatchId), 'Alex creates PENDING match with Aarav (201)');

  // 5.1 Recipient (Aarav) tries to send message while PENDING -> 409
  const recipientSendRes = await fetch(`${BASE_URL}/api/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: aaravCookie },
    body: JSON.stringify({ matchId: pendingMatchId, content: 'Reply from recipient' }),
  });
  const recipientSendData = await recipientSendRes.json();
  assert(
    recipientSendRes.status === 409 && recipientSendData.error === 'Accept the request to reply.',
    'Recipient cannot send messages on PENDING match (409: "Accept the request to reply.")',
    `Status ${recipientSendRes.status}: "${recipientSendData.error}"`
  );

  // 5.2 Requester (Alex) sends messages 1, 2, and 3 while PENDING -> all 201
  for (let i = 1; i <= 3; i++) {
    const msgRes = await fetch(`${BASE_URL}/api/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: alexCookie },
      body: JSON.stringify({ matchId: pendingMatchId, content: `Intro message ${i}` }),
    });
    assert(msgRes.status === 201, `Requester sends message ${i} on PENDING match (201)`);
  }

  // 5.3 Requester (Alex) attempts 4th message while PENDING -> 409
  const fourthMsgRes = await fetch(`${BASE_URL}/api/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: alexCookie },
    body: JSON.stringify({ matchId: pendingMatchId, content: 'Intro message 4 (should exceed quota)' }),
  });
  const fourthMsgData = await fourthMsgRes.json();
  assert(
    fourthMsgRes.status === 409 && fourthMsgData.error === 'You can send up to 3 messages until the request is accepted.',
    'Requester 4th message on PENDING match rejected with 409',
    `Status ${fourthMsgRes.status}: "${fourthMsgData.error}"`
  );

  // 5.4 Aarav DECLINES the match
  const declineRes = await fetch(`${BASE_URL}/api/matches/${pendingMatchId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Cookie: aaravCookie },
    body: JSON.stringify({ status: 'DECLINED' }),
  });
  assert(declineRes.status === 200, 'Aarav declines connection request (200)');

  // 5.5 Alex attempts to send on DECLINED match -> 409
  const declinedMsgRes = await fetch(`${BASE_URL}/api/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: alexCookie },
    body: JSON.stringify({ matchId: pendingMatchId, content: 'Message after decline' }),
  });
  const declinedMsgData = await declinedMsgRes.json();
  assert(
    declinedMsgRes.status === 409 && declinedMsgData.error === 'This connection request was declined.',
    'Message on DECLINED match rejected with 409: "This connection request was declined."',
    `Status ${declinedMsgRes.status}: "${declinedMsgData.error}"`
  );

  // Section 6: Security Headers Presence Check
  console.log('\n--- 6. Security Headers Presence Check ---');
  const headersRes = await fetch(`${BASE_URL}/api/health`);
  assert(headersRes.headers.get('permissions-policy') === 'camera=(), microphone=(), geolocation=()', 'Permissions-Policy header present and restrictive');
  assert(headersRes.headers.get('referrer-policy') === 'strict-origin-when-cross-origin', 'Referrer-Policy: strict-origin-when-cross-origin header present');
  assert(headersRes.headers.get('cross-origin-opener-policy') === 'same-origin', 'Cross-Origin-Opener-Policy: same-origin header present');
  assert(headersRes.headers.get('x-powered-by') === null, 'X-Powered-By header disabled and absent');

  console.log(`\n======================================================`);
  console.log(`Security2 Checks Complete: ${passed} PASSED, ${failed} FAILED`);
  console.log(`======================================================\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

runSecurity2Checks().catch((err) => {
  console.error('Security2 check fatal error:', err);
  process.exit(1);
});

