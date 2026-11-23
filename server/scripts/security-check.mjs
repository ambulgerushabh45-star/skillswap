/**
 * SkillSwap API Security & Authorization Automated Verification Script (Express)
 * Task M2 / P2.1
 *
 * Verifies authentication (401) on all protected routes and authorization (403/400)
 * ownership guards using seeded accounts.
 * Tests DENIAL cases only — performs zero persistent database mutations.
 */

import { login, DEFAULT_BASE_URL } from './test-auth-helper.mjs';

const BASE_URL = process.env.TEST_BASE_URL || DEFAULT_BASE_URL;

let passCount = 0;
let failCount = 0;

function assertCheck(name, passed, detail = '') {
  if (passed) {
    passCount++;
    console.log(`[PASS] ${name}${detail ? ` — ${detail}` : ''}`);
  } else {
    failCount++;
    console.error(`[FAIL] ${name}${detail ? ` — ${detail}` : ''}`);
  }
}

async function run() {
  console.log(`\n======================================================`);
  console.log(`Starting SkillSwap Security Checks on ${BASE_URL}`);
  console.log(`======================================================\n`);

  // PART 1: Unauthenticated 401 checks on protected endpoints
  console.log(`--- Part 1: Unauthenticated Session Guards (401 Expected) ---`);

  const unauthTests = [
    { method: 'POST', url: '/api/skills', body: { name: 'UnauthorizedSkill' } },
    { method: 'GET', url: '/api/matches' },
    { method: 'POST', url: '/api/matches', body: { targetUserId: 'dummy' } },
    { method: 'PATCH', url: '/api/matches/any-id', body: { status: 'ACCEPTED' } },
    { method: 'GET', url: '/api/messages?matchId=any-id' },
    { method: 'POST', url: '/api/messages', body: { matchId: 'any-id', content: 'test' } },
    { method: 'GET', url: '/api/conversations' },
    { method: 'POST', url: '/api/reviews', body: { toUserId: 'dummy', rating: 5, comment: 'test' } },
    { method: 'GET', url: '/api/user/profile' },
    { method: 'PUT', url: '/api/user/profile', body: { bio: 'hack' } },
    { method: 'POST', url: '/api/events', body: { title: 'hack', description: 'd', location: 'l', dateTime: '2026-10-25' } },
    { method: 'POST', url: '/api/events/any-id/rsvp' },
  ];

  for (const t of unauthTests) {
    const res = await fetch(`${BASE_URL}${t.url}`, {
      method: t.method,
      headers: { 'Content-Type': 'application/json' },
      body: t.body ? JSON.stringify(t.body) : undefined,
    });
    assertCheck(
      `Unauth ${t.method} ${t.url} returns 401`,
      res.status === 401,
      `Got HTTP ${res.status}`
    );
  }

  // PART 2: Authenticated Authorization & Ownership Checks
  console.log(`\n--- Part 2: Authenticated Authorization & Ownership Guards ---`);

  console.log(`Authenticating test users...`);
  const alexCookie = await login('alex@example.com', 'password123', BASE_URL);
  const rohanCookie = await login('rohan.verma@example.com', 'password123', BASE_URL);

  const alexProfileRes = await fetch(`${BASE_URL}/api/user/profile`, {
    headers: { Cookie: alexCookie },
  });
  const alexProfileData = await alexProfileRes.json();
  const alexId = alexProfileData.user?.id;

  assertCheck(
    'Alex profile loads without leaking passwordHash',
    alexProfileRes.status === 200 && alexProfileData.user && !('passwordHash' in alexProfileData.user),
    `id: ${alexId}, passwordHash leaked: ${'passwordHash' in (alexProfileData.user || {})}`
  );

  const convRes = await fetch(`${BASE_URL}/api/conversations`, {
    headers: { Cookie: alexCookie },
  });
  const convData = await convRes.json();
  const testMatchId = convData.conversations?.[0]?.matchId;

  if (!testMatchId) {
    console.error('Warning: No match found for Alex in seeded database; skipping match-specific tests.');
  } else {
    // Check 1: Alex is requester (userA). Alex attempts to accept their own connection request.
    const alexAcceptRes = await fetch(`${BASE_URL}/api/matches/${testMatchId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Cookie: alexCookie,
      },
      body: JSON.stringify({ status: 'ACCEPTED' }),
    });
    assertCheck(
      'Requester (userA) cannot accept their own connection request',
      alexAcceptRes.status === 403,
      `Got HTTP ${alexAcceptRes.status}`
    );

    // Check 2: Rohan is a non-participant. Rohan attempts to PATCH match status.
    const rohanPatchRes = await fetch(`${BASE_URL}/api/matches/${testMatchId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Cookie: rohanCookie,
      },
      body: JSON.stringify({ status: 'ACCEPTED' }),
    });
    assertCheck(
      'Non-participant cannot PATCH match status',
      rohanPatchRes.status === 403,
      `Got HTTP ${rohanPatchRes.status}`
    );

    // Check 3: Rohan is a non-participant. Rohan attempts to read messages for Alex's match.
    const rohanReadMsgRes = await fetch(`${BASE_URL}/api/messages?matchId=${testMatchId}`, {
      headers: { Cookie: rohanCookie },
    });
    assertCheck(
      "Non-participant cannot read messages of another user's match",
      rohanReadMsgRes.status === 403,
      `Got HTTP ${rohanReadMsgRes.status}`
    );

    // Check 4: Rohan is a non-participant. Rohan attempts to post a message into Alex's match.
    const rohanPostMsgRes = await fetch(`${BASE_URL}/api/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: rohanCookie,
      },
      body: JSON.stringify({ matchId: testMatchId, content: 'Intruder message' }),
    });
    assertCheck(
      "Non-participant cannot post messages into another user's match",
      rohanPostMsgRes.status === 403,
      `Got HTTP ${rohanPostMsgRes.status}`
    );
  }

  // Check 5: Rohan attempts to submit a review for Alex without having an ACCEPTED match
  const rohanReviewRes = await fetch(`${BASE_URL}/api/reviews`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: rohanCookie,
    },
    body: JSON.stringify({
      toUserId: alexId,
      rating: 5,
      comment: 'Trying to review someone without an accepted match',
    }),
  });
  assertCheck(
    'User cannot review someone without an ACCEPTED match',
    rohanReviewRes.status === 403,
    `Got HTTP ${rohanReviewRes.status}`
  );

  // Check 6: Self-review block
  const alexSelfReviewRes = await fetch(`${BASE_URL}/api/reviews`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: alexCookie,
    },
    body: JSON.stringify({
      toUserId: alexId,
      rating: 5,
      comment: 'Self praise',
    }),
  });
  assertCheck(
    'User cannot submit a self-review (400)',
    alexSelfReviewRes.status === 400,
    `Got HTTP ${alexSelfReviewRes.status}`
  );

  // Check 7: Self-connection block
  const alexSelfConnectRes = await fetch(`${BASE_URL}/api/matches`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: alexCookie,
    },
    body: JSON.stringify({
      targetUserId: alexId,
    }),
  });
  assertCheck(
    'User cannot connect to themselves (400)',
    alexSelfConnectRes.status === 400,
    `Got HTTP ${alexSelfConnectRes.status}`
  );

  console.log(`\n======================================================`);
  console.log(`Security Checks Complete: ${passCount} PASSED, ${failCount} FAILED`);
  console.log(`======================================================\n`);

  if (failCount > 0) {
    process.exit(1);
  }
}

run().catch((err) => {
  console.error('Security check script error:', err);
  process.exit(1);
});

