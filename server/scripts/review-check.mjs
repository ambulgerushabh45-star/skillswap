// server/scripts/review-check.mjs
// Verifies review rules and duplicate rejection logic against running Express server

import { prisma } from '../src/db/prisma.js';
import { login, DEFAULT_BASE_URL } from './test-auth-helper.mjs';

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

async function runReviewChecks() {
  console.log(`\n======================================================`);
  console.log(`Starting SkillSwap Review Rules Checks on ${BASE_URL}`);
  console.log(`======================================================\n`);

  const initialReviewCount = await prisma.review.count();

  // Find seeded review (Alex -> Priya)
  const seededReview = await prisma.review.findFirst({
    include: {
      fromUser: { select: { id: true, email: true, name: true } },
      toUser: { select: { id: true, email: true, name: true } },
    },
  });

  if (!seededReview) {
    throw new Error('No seeded review found in database; cannot verify duplicate review rule.');
  }

  const alexId = seededReview.fromUser.id;
  const priyaId = seededReview.toUser.id;

  console.log(`Found seeded review: ${seededReview.fromUser.name} (${seededReview.fromUser.email}) -> ${seededReview.toUser.name} (${seededReview.toUser.email})`);

  // Sign in Alex and Rohan
  console.log('Signing in test users...');
  const alexCookie = await login(seededReview.fromUser.email, 'password123', BASE_URL);
  const rohanCookie = await login('rohan.verma@example.com', 'password123', BASE_URL);

  // 1. Unauthenticated request check (401)
  const unauthRes = await fetch(`${BASE_URL}/api/reviews`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      toUserId: priyaId,
      rating: 5,
      comment: 'Unauth attempt',
    }),
  });
  const unauthData = await unauthRes.json();
  assertCheck(
    'Unauthenticated review submission returns 401',
    unauthRes.status === 401 && unauthData.error === 'Unauthorized',
    `Status ${unauthRes.status}`
  );

  // 2. Self-review check (400)
  const selfRes = await fetch(`${BASE_URL}/api/reviews`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: alexCookie,
    },
    body: JSON.stringify({
      toUserId: alexId,
      rating: 5,
      comment: 'Self review attempt',
    }),
  });
  const selfData = await selfRes.json();
  assertCheck(
    'Self-review submission returns 400 Bad Request',
    selfRes.status === 400 && selfData.error === 'You cannot review yourself',
    `Status ${selfRes.status}: "${selfData.error}"`
  );

  // 3. User without ACCEPTED match (403)
  const noMatchRes = await fetch(`${BASE_URL}/api/reviews`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: rohanCookie,
    },
    body: JSON.stringify({
      toUserId: alexId,
      rating: 5,
      comment: 'Rohan reviewing Alex with no accepted match',
    }),
  });
  const noMatchData = await noMatchRes.json();
  assertCheck(
    'Review submission without an ACCEPTED match returns 403 Forbidden',
    noMatchRes.status === 403 &&
      noMatchData.error === 'You can only review users you have an accepted match with',
    `Status ${noMatchRes.status}: "${noMatchData.error}"`
  );

  // 4. Duplicate review submission (409)
  const duplicateRes = await fetch(`${BASE_URL}/api/reviews`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: alexCookie,
    },
    body: JSON.stringify({
      toUserId: priyaId,
      rating: 4,
      comment: 'Duplicate review attempt for Priya',
    }),
  });
  const duplicateData = await duplicateRes.json();
  assertCheck(
    'Duplicate review submission returns 409 Conflict',
    duplicateRes.status === 409 &&
      duplicateData.error === 'You have already reviewed this person.',
    `Status ${duplicateRes.status}: "${duplicateData.error}"`
  );

  // 5. Verify zero data created
  const finalReviewCount = await prisma.review.count();
  assertCheck(
    'Zero new reviews created during checks',
    initialReviewCount === finalReviewCount,
    `Initial: ${initialReviewCount}, Final: ${finalReviewCount}`
  );

  console.log(`\n======================================================`);
  console.log(`Review Checks Complete: ${passed} PASSED, ${failed} FAILED`);
  console.log(`======================================================\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

runReviewChecks()
  .catch((err) => {
    console.error('Review check execution error:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

