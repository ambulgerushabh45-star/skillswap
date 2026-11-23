// server/scripts/profile-check.mjs
// Automated verification script for public peer profile API (Express)
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

async function runProfileChecks() {
  console.log(`\n======================================================`);
  console.log(`Starting SkillSwap Public Profile Checks on ${BASE_URL}`);
  console.log(`======================================================\n`);

  const initialRowCount = await prisma.user.count();

  // 1. Unauthenticated request -> 401
  const unauthRes = await fetch(`${BASE_URL}/api/users/any-user-id`);
  const unauthData = await unauthRes.json();
  assertCheck(
    'Unauthenticated profile request returns 401 Unauthorized',
    unauthRes.status === 401 && unauthData.error === 'Unauthorized',
    `Status ${unauthRes.status}`
  );

  // Lookup test users from DB
  const alexUser = await prisma.user.findUnique({ where: { email: 'alex@example.com' } });
  const priyaUser = await prisma.user.findUnique({ where: { email: 'priya.patel@example.com' } });
  const rimiUser = await prisma.user.findUnique({ where: { email: 'rimi@gmail.com' } });

  if (!alexUser || !priyaUser || !rimiUser) {
    throw new Error('Seeded accounts (Alex, Priya, Rimi) not found in database.');
  }

  // Authenticate test users
  console.log('Generating session tokens for test users (Alex and Rimi)...');
  const alexCookie = getSessionCookie(alexUser.id);
  const rimiCookie = getSessionCookie(rimiUser.id);

  // 2. Invalid id param -> 400
  const invalidIdRes = await fetch(`${BASE_URL}/api/users/%20%20`, {
    headers: { Cookie: alexCookie },
  });
  assertCheck(
    'Whitespace / empty ID param returns 400 Bad Request',
    invalidIdRes.status === 400,
    `Status ${invalidIdRes.status}`
  );

  // 3. Unknown valid UUID -> 404
  const unknownUuid = '00000000-0000-0000-0000-000000000000';
  const notFoundRes = await fetch(`${BASE_URL}/api/users/${unknownUuid}`, {
    headers: { Cookie: alexCookie },
  });
  const notFoundData = await notFoundRes.json();
  assertCheck(
    'Unknown UUID returns 404 Not Found with standard error format',
    notFoundRes.status === 404 && notFoundData.error === 'User not found',
    `Status ${notFoundRes.status}: "${notFoundData.error}"`
  );

  // 4. Real user profile (Priya) as viewed by Alex -> 200 and strict privacy check
  const priyaProfileRes = await fetch(`${BASE_URL}/api/users/${priyaUser.id}`, {
    headers: { Cookie: alexCookie },
  });
  assertCheck(
    'Real user profile returns 200 OK',
    priyaProfileRes.status === 200,
    `Status ${priyaProfileRes.status}`
  );

  const priyaRawText = await priyaProfileRes.text();
  const priyaData = JSON.parse(priyaRawText);

  // Privacy Full-Text Audit: "email", "passwordHash", "latitude", "longitude" must NOT appear anywhere in the response text
  const leaksEmail = priyaRawText.toLowerCase().includes('email');
  const leaksHash = priyaRawText.toLowerCase().includes('passwordhash');
  const leaksLat = priyaRawText.toLowerCase().includes('latitude') || priyaRawText.toLowerCase().includes('"lat"');
  const leaksLng = priyaRawText.toLowerCase().includes('longitude') || priyaRawText.toLowerCase().includes('"lng"');

  assertCheck(
    'Full-text response contains zero email leaks',
    !leaksEmail,
    `Contains 'email': ${leaksEmail}`
  );
  assertCheck(
    'Full-text response contains zero passwordHash leaks',
    !leaksHash,
    `Contains 'passwordHash': ${leaksHash}`
  );
  assertCheck(
    'Full-text response contains zero latitude/longitude leaks',
    !leaksLat && !leaksLng,
    `Contains coordinates: lat=${leaksLat}, lng=${leaksLng}`
  );

  // 5. Check Priya's rating count and review details
  assertCheck(
    "Priya's profile reflects 1 review with average 5.0",
    priyaData.rating?.count === 1 && priyaData.rating?.average === 5.0,
    `count: ${priyaData.rating?.count}, average: ${priyaData.rating?.average}`
  );

  // 6. Check viewer state when Alex views Priya (Alex already reviewed Priya)
  assertCheck(
    'Alex viewing Priya reflects viewer.hasReviewed === true and isSelf === false',
    priyaData.viewer?.isSelf === false && priyaData.viewer?.hasReviewed === true,
    `isSelf: ${priyaData.viewer?.isSelf}, hasReviewed: ${priyaData.viewer?.hasReviewed}`
  );

  // 7. Check viewer state on own profile (Alex viewing Alex)
  const alexProfileRes = await fetch(`${BASE_URL}/api/users/${alexUser.id}`, {
    headers: { Cookie: alexCookie },
  });
  const alexData = await alexProfileRes.json();
  assertCheck(
    'Viewer viewing own profile reflects viewer.isSelf === true',
    alexData.viewer?.isSelf === true && alexData.viewer?.matchStatus === 'NONE',
    `isSelf: ${alexData.viewer?.isSelf}, matchStatus: ${alexData.viewer?.matchStatus}`
  );

  // 8. Check user with zero reviews (Rimi has 0 reviews) -> rating.average must be null
  const rimiProfileRes = await fetch(`${BASE_URL}/api/users/${rimiUser.id}`, {
    headers: { Cookie: alexCookie },
  });
  const rimiData = await rimiProfileRes.json();
  assertCheck(
    'User with zero reviews returns rating.average === null and rating.count === 0',
    rimiData.rating?.count === 0 && rimiData.rating?.average === null,
    `count: ${rimiData.rating?.count}, average: ${rimiData.rating?.average}`
  );

  // 9. Check Rimi viewing Alex (Rimi has not reviewed Alex)
  const rimiViewAlexRes = await fetch(`${BASE_URL}/api/users/${alexUser.id}`, {
    headers: { Cookie: rimiCookie },
  });
  const rimiViewAlexData = await rimiViewAlexRes.json();
  assertCheck(
    'Rimi viewing Alex reflects viewer.hasReviewed === false',
    rimiViewAlexData.viewer?.hasReviewed === false && rimiViewAlexData.viewer?.isSelf === false,
    `hasReviewed: ${rimiViewAlexData.viewer?.hasReviewed}`
  );

  // 10. Confirm zero DB rows created (read-only verification)
  const finalRowCount = await prisma.user.count();
  assertCheck(
    'Zero database records created during profile checks',
    initialRowCount === finalRowCount,
    `Initial: ${initialRowCount}, Final: ${finalRowCount}`
  );

  console.log(`\n======================================================`);
  console.log(`Profile Checks Complete: ${passed} PASSED, ${failed} FAILED`);
  console.log(`======================================================\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

runProfileChecks()
  .catch((err) => {
    console.error('Profile check failed with error:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

