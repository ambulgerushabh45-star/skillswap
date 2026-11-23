// server/scripts/distance-check.mjs
// Automated verification script for Haversine Distance & Privacy (Express)
// Read-only tests against http://localhost:4000

import { prisma } from '../src/db/prisma.js';
import { getSessionCookie, DEFAULT_BASE_URL } from './test-auth-helper.mjs';

const BASE_URL = process.env.TEST_BASE_URL || DEFAULT_BASE_URL;

let passed = 0;
let failed = 0;

function assertCheck(name, condition, details = '') {
  if (condition) {
    console.log(`[PASS] ${name} ${details ? `— ${details}` : ''}`);
    passed++;
  } else {
    console.error(`[FAIL] ${name} ${details ? `— ${details}` : ''}`);
    failed++;
  }
}

async function runDistanceChecks() {
  console.log(`\n======================================================`);
  console.log(`Starting SkillSwap Distance & Privacy Checks on ${BASE_URL}`);
  console.log(`======================================================\n`);

  // 1. Unauthenticated checks
  console.log('--- 1. Authentication Guards ---');
  const unauthRes = await fetch(`${BASE_URL}/api/matches`);
  assertCheck(
    'Unauthenticated /api/matches returns 401',
    unauthRes.status === 401,
    `Status: ${unauthRes.status}`
  );

  // Load test users
  const alex = await prisma.user.findUnique({ where: { email: 'alex@example.com' } });
  const rimi = await prisma.user.findUnique({ where: { email: 'rimi@gmail.com' } });

  if (!alex || !rimi) {
    console.error('Test users alex@example.com or rimi@gmail.com not found in database.');
    process.exit(1);
  }

  const alexCookie = getSessionCookie(alex.id);
  const rimiCookie = getSessionCookie(rimi.id);

  // 2. Matches checks for Alex
  console.log('\n--- 2. Matches API & Privacy Guarantees (Alex) ---');
  const alexMatchesRes = await fetch(`${BASE_URL}/api/matches`, {
    headers: { Cookie: alexCookie },
  });
  assertCheck('Alex GET /api/matches status is 200', alexMatchesRes.status === 200);

  const alexMatchesRawText = await alexMatchesRes.text();
  assertCheck(
    "Alex /api/matches response contains NO 'latitude' keys in JSON text",
    !alexMatchesRawText.includes('"latitude"')
  );
  assertCheck(
    "Alex /api/matches response contains NO 'longitude' keys in JSON text",
    !alexMatchesRawText.includes('"longitude"')
  );

  const alexMatchesData = JSON.parse(alexMatchesRawText);
  assertCheck(
    'currentUser.hasLocation is a boolean',
    typeof alexMatchesData.currentUser?.hasLocation === 'boolean',
    `Value: ${alexMatchesData.currentUser?.hasLocation}`
  );

  // Check currentUser old fields
  const expectedCurrentUserFields = ['id', 'name', 'email', 'location', 'teachCount', 'learnCount'];
  const missingCurrentUserFields = expectedCurrentUserFields.filter(
    (f) => !(f in (alexMatchesData.currentUser || {}))
  );
  assertCheck(
    'currentUser retains all existing fields',
    missingCurrentUserFields.length === 0,
    missingCurrentUserFields.length > 0 ? `Missing: ${missingCurrentUserFields.join(', ')}` : 'All present'
  );

  // Check matches items
  const expectedMatchFields = [
    'id',
    'name',
    'email',
    'bio',
    'location',
    'avatarUrl',
    'avgRating',
    'reviewCount',
    'isMutual',
    'matchedSkillName',
    'connectionStatus',
    'matchId',
    'skillsTeach',
    'skillsLearn',
    'distanceKm',
  ];

  const matches = alexMatchesData.matches || [];
  assertCheck('Alex matches list is an array', Array.isArray(matches) && matches.length > 0);

  let allMatchFieldsValid = true;
  let allDistancesWholeOrNull = true;
  for (const m of matches) {
    for (const f of expectedMatchFields) {
      if (!(f in m)) {
        allMatchFieldsValid = false;
      }
    }
    if (m.distanceKm !== null && !Number.isInteger(m.distanceKm)) {
      allDistancesWholeOrNull = false;
    }
  }

  assertCheck(
    'Every match item retains all existing fields plus distanceKm',
    allMatchFieldsValid
  );
  assertCheck(
    'All match distanceKm values are whole numbers or null (rounded to whole km)',
    allDistancesWholeOrNull
  );

  // 3. Matches checks for Rimi
  console.log('\n--- 3. Matches API & Privacy Guarantees (Rimi) ---');
  const rimiMatchesRes = await fetch(`${BASE_URL}/api/matches`, {
    headers: { Cookie: rimiCookie },
  });
  assertCheck('Rimi GET /api/matches status is 200', rimiMatchesRes.status === 200);

  const rimiMatchesRawText = await rimiMatchesRes.text();
  assertCheck(
    "Rimi /api/matches response contains NO 'latitude' keys in JSON text",
    !rimiMatchesRawText.includes('"latitude"')
  );
  assertCheck(
    "Rimi /api/matches response contains NO 'longitude' keys in JSON text",
    !rimiMatchesRawText.includes('"longitude"')
  );

  const rimiMatchesData = JSON.parse(rimiMatchesRawText);
  assertCheck(
    'Rimi currentUser.hasLocation is a boolean',
    typeof rimiMatchesData.currentUser?.hasLocation === 'boolean'
  );

  // 4. Events API checks
  console.log('\n--- 4. Events API with Distance (Alex & Rimi) ---');
  const expectedEventFields = [
    'id',
    'hostId',
    'hostName',
    'hostAvatar',
    'title',
    'description',
    'location',
    'lat',
    'lng',
    'dateTime',
    'attendeeCount',
    'isGoing',
    'isHost',
    'distanceKm',
  ];

  const alexEventsRes = await fetch(`${BASE_URL}/api/events`, {
    headers: { Cookie: alexCookie },
  });
  assertCheck('Alex GET /api/events status is 200', alexEventsRes.status === 200);
  const alexEventsData = await alexEventsRes.json();
  const events = alexEventsData.events || [];
  assertCheck('Events list is non-empty array', Array.isArray(events) && events.length > 0);

  let allEventFieldsValid = true;
  let allEventDistancesValid = true;
  for (const e of events) {
    for (const f of expectedEventFields) {
      if (!(f in e)) {
        allEventFieldsValid = false;
      }
    }
    if (e.distanceKm !== null && typeof e.distanceKm !== 'number') {
      allEventDistancesValid = false;
    }
  }
  assertCheck('Every event item retains all existing fields plus distanceKm', allEventFieldsValid);
  assertCheck(
    'Every event distanceKm is a number or null',
    allEventDistancesValid
  );

  // 5. Public Profile Privacy Check
  console.log('\n--- 5. Public Profile (/api/users/[id]) Privacy Check ---');
  const targetPeer = matches[0];
  if (targetPeer) {
    const peerProfileRes = await fetch(`${BASE_URL}/api/users/${targetPeer.id}`, {
      headers: { Cookie: alexCookie },
    });
    assertCheck('GET /api/users/[id] status is 200', peerProfileRes.status === 200);

    const peerProfileText = await peerProfileRes.text();
    assertCheck(
      "/api/users/[id] JSON contains NO 'latitude' keys",
      !peerProfileText.includes('"latitude"')
    );
    assertCheck(
      "/api/users/[id] JSON contains NO 'longitude' keys",
      !peerProfileText.includes('"longitude"')
    );
  }

  // 6. Pagination & Data Shape Check
  console.log('\n--- 6. Backward Compatibility & Shape Check ---');
  assertCheck(
    'Matches response has pagination metadata',
    typeof alexMatchesData.pagination === 'object' && alexMatchesData.pagination !== null
  );
  assertCheck(
    'Events response has pagination metadata',
    typeof alexEventsData.pagination === 'object' && alexEventsData.pagination !== null
  );

  console.log(`\n======================================================`);
  console.log(`Results: ${passed} passed, ${failed} failed`);
  console.log(`======================================================\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

runDistanceChecks()
  .catch((e) => {
    console.error('Error running distance checks:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

