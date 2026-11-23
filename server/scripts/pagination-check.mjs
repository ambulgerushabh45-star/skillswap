/**
 * SkillSwap API Pagination Verification Script (Express)
 * Task M2 / P2.2 & P2.3
 */

import { login, DEFAULT_BASE_URL } from './test-auth-helper.mjs';

const BASE_URL = process.env.TEST_BASE_URL || DEFAULT_BASE_URL;

let passed = 0;
let failed = 0;

function assert(condition, testName, detail = '') {
  if (condition) {
    console.log(`[PASS] ${testName}`);
    passed++;
  } else {
    console.error(`[FAIL] ${testName}${detail ? ` — ${detail}` : ''}`);
    failed++;
  }
}

async function main() {
  console.log(`Running pagination-check.mjs against ${BASE_URL}...\n`);
  const alexCookie = await login('alex@example.com', 'password123', BASE_URL);
  const alexHeaders = { Cookie: alexCookie };

  // =========================================================================
  // 1. Unauthenticated checks (must return 401 for protected list routes)
  // =========================================================================
  console.log('--- 1. Authentication Gate Checks ---');
  const unauthMatches = await fetch(`${BASE_URL}/api/matches`);
  assert(unauthMatches.status === 401, 'GET /api/matches unauthenticated returns 401');

  const unauthConvs = await fetch(`${BASE_URL}/api/conversations`);
  assert(unauthConvs.status === 401, 'GET /api/conversations unauthenticated returns 401');

  const unauthMessages = await fetch(`${BASE_URL}/api/messages?matchId=06cf5119-ea31-4fd4-96b4-a8ce75833237`);
  assert(unauthMessages.status === 401, 'GET /api/messages unauthenticated returns 401');

  // =========================================================================
  // 2. GET /api/matches pagination
  // =========================================================================
  console.log('\n--- 2. GET /api/matches Pagination ---');
  const matchesBase = await fetch(`${BASE_URL}/api/matches`, { headers: alexHeaders });
  const matchesBaseData = await matchesBase.json();
  assert(
    matchesBase.status === 200 && Array.isArray(matchesBaseData.matches) && matchesBaseData.currentUser,
    'GET /api/matches baseline returns 200 with currentUser and matches array'
  );
  assert(
    matchesBaseData.pagination && typeof matchesBaseData.pagination.total === 'number',
    'GET /api/matches baseline includes pagination object'
  );
  assert(
    matchesBase.headers.get('X-Total-Count') !== null && matchesBase.headers.get('X-Page') === '1',
    'GET /api/matches baseline includes X-Total-Count and X-Page headers'
  );

  // limit=1
  const matchesLimit1 = await fetch(`${BASE_URL}/api/matches?limit=1`, { headers: alexHeaders });
  const matchesL1Data = await matchesLimit1.json();
  assert(
    matchesLimit1.status === 200 && matchesL1Data.matches.length === 1,
    'GET /api/matches?limit=1 returns exactly 1 match'
  );
  assert(
    matchesL1Data.pagination.limit === 1 && matchesL1Data.pagination.hasNextPage === true,
    'GET /api/matches?limit=1 pagination metadata has limit=1 and hasNextPage=true'
  );
  assert(
    matchesLimit1.headers.get('X-Next-Page') === '2',
    'GET /api/matches?limit=1 response includes header X-Next-Page: 2'
  );

  // page=2&limit=1
  const matchesPage2 = await fetch(`${BASE_URL}/api/matches?page=2&limit=1`, { headers: alexHeaders });
  const matchesP2Data = await matchesPage2.json();
  assert(
    matchesPage2.status === 200 && matchesP2Data.matches.length === 1,
    'GET /api/matches?page=2&limit=1 returns 1 match'
  );
  assert(
    matchesP2Data.matches[0].id !== matchesL1Data.matches[0].id,
    'GET /api/matches page 2 returns next candidate without repeating page 1'
  );

  // Invalid parameters
  const matchesLim0 = await fetch(`${BASE_URL}/api/matches?limit=0`, { headers: alexHeaders });
  assert(matchesLim0.status === 400, 'GET /api/matches?limit=0 rejected with 400');

  const matchesLimAbc = await fetch(`${BASE_URL}/api/matches?limit=abc`, { headers: alexHeaders });
  assert(matchesLimAbc.status === 400, 'GET /api/matches?limit=abc rejected with 400');

  const matchesLimHuge = await fetch(`${BASE_URL}/api/matches?limit=100000`, { headers: alexHeaders });
  assert(matchesLimHuge.status === 400, 'GET /api/matches?limit=100000 rejected with 400');

  const matchesPage0 = await fetch(`${BASE_URL}/api/matches?page=0`, { headers: alexHeaders });
  assert(matchesPage0.status === 400, 'GET /api/matches?page=0 rejected with 400');

  // =========================================================================
  // 3. GET /api/events pagination
  // =========================================================================
  console.log('\n--- 3. GET /api/events Pagination ---');
  const eventsBase = await fetch(`${BASE_URL}/api/events`);
  const eventsBaseData = await eventsBase.json();
  assert(
    eventsBase.status === 200 && Array.isArray(eventsBaseData.events),
    'GET /api/events baseline returns 200 with events array'
  );
  assert(
    eventsBaseData.pagination && typeof eventsBaseData.pagination.total === 'number',
    'GET /api/events baseline includes pagination object'
  );
  assert(
    eventsBase.headers.get('X-Total-Count') !== null,
    'GET /api/events baseline includes X-Total-Count header'
  );

  // limit=1
  const eventsLimit1 = await fetch(`${BASE_URL}/api/events?limit=1`);
  const eventsL1Data = await eventsLimit1.json();
  assert(
    eventsLimit1.status === 200 && eventsL1Data.events.length === 1,
    'GET /api/events?limit=1 returns exactly 1 event'
  );
  assert(
    eventsL1Data.pagination.hasNextPage === true && eventsLimit1.headers.get('X-Next-Page') === '2',
    'GET /api/events?limit=1 indicates hasNextPage and X-Next-Page: 2'
  );

  // page=2&limit=1
  const eventsPage2 = await fetch(`${BASE_URL}/api/events?page=2&limit=1`);
  const eventsP2Data = await eventsPage2.json();
  assert(
    eventsPage2.status === 200 && eventsP2Data.events.length === 1,
    'GET /api/events?page=2&limit=1 returns 1 event'
  );
  assert(
    eventsP2Data.events[0].id !== eventsL1Data.events[0].id,
    'GET /api/events page 2 returns distinct event without repeating'
  );

  // Invalid limits
  const eventsLim0 = await fetch(`${BASE_URL}/api/events?limit=0`);
  assert(eventsLim0.status === 400, 'GET /api/events?limit=0 rejected with 400');

  const eventsLimAbc = await fetch(`${BASE_URL}/api/events?limit=abc`);
  assert(eventsLimAbc.status === 400, 'GET /api/events?limit=abc rejected with 400');

  const eventsLimHuge = await fetch(`${BASE_URL}/api/events?limit=100000`);
  assert(eventsLimHuge.status === 400, 'GET /api/events?limit=100000 rejected with 400');

  // =========================================================================
  // 4. GET /api/conversations pagination
  // =========================================================================
  console.log('\n--- 4. GET /api/conversations Pagination ---');
  const convsBase = await fetch(`${BASE_URL}/api/conversations`, { headers: alexHeaders });
  const convsBaseData = await convsBase.json();
  assert(
    convsBase.status === 200 && Array.isArray(convsBaseData.conversations),
    'GET /api/conversations baseline returns 200 with conversations array'
  );
  assert(
    convsBaseData.pagination && typeof convsBaseData.pagination.total === 'number',
    'GET /api/conversations baseline includes pagination object'
  );
  assert(
    convsBase.headers.get('X-Total-Count') !== null,
    'GET /api/conversations baseline includes X-Total-Count header'
  );

  // limit=1
  const convsLimit1 = await fetch(`${BASE_URL}/api/conversations?limit=1`, { headers: alexHeaders });
  const convsL1Data = await convsLimit1.json();
  assert(
    convsLimit1.status === 200 && convsL1Data.conversations.length <= 1,
    'GET /api/conversations?limit=1 returns at most 1 conversation'
  );

  // Invalid limits
  const convsLim0 = await fetch(`${BASE_URL}/api/conversations?limit=0`, { headers: alexHeaders });
  assert(convsLim0.status === 400, 'GET /api/conversations?limit=0 rejected with 400');

  const convsLimAbc = await fetch(`${BASE_URL}/api/conversations?limit=abc`, { headers: alexHeaders });
  assert(convsLimAbc.status === 400, 'GET /api/conversations?limit=abc rejected with 400');

  // =========================================================================
  // 5. GET /api/messages cursor pagination
  // =========================================================================
  console.log('\n--- 5. GET /api/messages Cursor Pagination ---');
  const alexMatchId = '06cf5119-ea31-4fd4-96b4-a8ce75833237';
  const msgsBase = await fetch(`${BASE_URL}/api/messages?matchId=${alexMatchId}`, {
    headers: alexHeaders,
  });
  const msgsBaseData = await msgsBase.json();
  assert(
    msgsBase.status === 200 && Array.isArray(msgsBaseData.messages),
    'GET /api/messages baseline returns 200 with messages array in ascending order'
  );
  assert(
    msgsBaseData.pagination && typeof msgsBaseData.pagination.hasMore === 'boolean',
    'GET /api/messages baseline includes cursor pagination object'
  );
  assert(
    msgsBase.headers.get('X-Total-Count') !== null && msgsBase.headers.get('X-Limit') === '200',
    'GET /api/messages baseline includes X-Total-Count and X-Limit: 200 headers'
  );

  // limit=1
  const msgsLimit1 = await fetch(`${BASE_URL}/api/messages?matchId=${alexMatchId}&limit=1`, {
    headers: alexHeaders,
  });
  const msgsL1Data = await msgsLimit1.json();
  assert(
    msgsLimit1.status === 200 && msgsL1Data.messages.length <= 1,
    'GET /api/messages?limit=1 returns at most 1 message'
  );

  // Invalid limits and malformed cursor
  const msgsLim0 = await fetch(`${BASE_URL}/api/messages?matchId=${alexMatchId}&limit=0`, {
    headers: alexHeaders,
  });
  assert(msgsLim0.status === 400, 'GET /api/messages?limit=0 rejected with 400');

  const msgsLimAbc = await fetch(`${BASE_URL}/api/messages?matchId=${alexMatchId}&limit=abc`, {
    headers: alexHeaders,
  });
  assert(msgsLimAbc.status === 400, 'GET /api/messages?limit=abc rejected with 400');

  const msgsLimHuge = await fetch(`${BASE_URL}/api/messages?matchId=${alexMatchId}&limit=100000`, {
    headers: alexHeaders,
  });
  assert(msgsLimHuge.status === 400, 'GET /api/messages?limit=100000 rejected with 400');

  const msgsBadCursor = await fetch(`${BASE_URL}/api/messages?matchId=${alexMatchId}&cursor=not-a-valid-cursor`, {
    headers: alexHeaders,
  });
  assert(msgsBadCursor.status === 400, 'GET /api/messages with nonexistent cursor rejected with 400');

  // =========================================================================
  // 6. GET /api/reviews pagination
  // =========================================================================
  console.log('\n--- 6. GET /api/reviews Pagination ---');
  const priyaId = 'a22dc032-5737-42ba-b356-2b7eb49dbeda'; // Priya Patel id
  const revBase = await fetch(`${BASE_URL}/api/reviews?toUserId=${priyaId}`, { headers: alexHeaders });
  const revBaseData = await revBase.json();
  assert(
    revBase.status === 200 && Array.isArray(revBaseData.reviews),
    'GET /api/reviews baseline returns 200 with reviews array'
  );
  assert(
    revBaseData.pagination && typeof revBaseData.pagination.total === 'number',
    'GET /api/reviews baseline includes pagination object'
  );
  assert(
    revBase.headers.get('X-Total-Count') !== null,
    'GET /api/reviews baseline includes X-Total-Count header'
  );

  // limit=1
  const revLimit1 = await fetch(`${BASE_URL}/api/reviews?toUserId=${priyaId}&limit=1`, { headers: alexHeaders });
  const revL1Data = await revLimit1.json();
  assert(
    revLimit1.status === 200 && revL1Data.reviews.length <= 1,
    'GET /api/reviews?limit=1 returns at most 1 review'
  );

  // Invalid limits
  const revLim0 = await fetch(`${BASE_URL}/api/reviews?toUserId=${priyaId}&limit=0`, { headers: alexHeaders });
  assert(revLim0.status === 400, 'GET /api/reviews?limit=0 rejected with 400');

  const revLimAbc = await fetch(`${BASE_URL}/api/reviews?toUserId=${priyaId}&limit=abc`, { headers: alexHeaders });
  assert(revLimAbc.status === 400, 'GET /api/reviews?limit=abc rejected with 400');

  const revLimHuge = await fetch(`${BASE_URL}/api/reviews?toUserId=${priyaId}&limit=100000`, { headers: alexHeaders });
  assert(revLimHuge.status === 400, 'GET /api/reviews?limit=100000 rejected with 400');

  // Missing toUserId
  const revNoUser = await fetch(`${BASE_URL}/api/reviews`, { headers: alexHeaders });
  assert(revNoUser.status === 400, 'GET /api/reviews without toUserId rejected with 400');

  // Summary
  console.log(`\n======================================================`);
  console.log(`Pagination Check Results: ${passed} passed, ${failed} failed`);
  console.log(`======================================================`);

  if (failed > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Pagination check error:', err);
  process.exit(1);
});

