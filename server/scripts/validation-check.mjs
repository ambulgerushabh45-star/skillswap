/**
 * SkillSwap API Request Validation Automated Verification Script (Express)
 * Task M2 / P2.2 & P2.3
 *
 * Verifies declarative Zod schema validation and standard 400 error responses
 * across all API routes.
 * Tests REJECTION cases only — zero database mutations or side effects.
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
  console.log(`Starting SkillSwap Validation & Error Checks on ${BASE_URL}`);
  console.log(`======================================================\n`);

  // SECTION 1: Public Route Validation (Registration & Malformed JSON)
  console.log(`--- Section 1: Registration & JSON Payload Validation ---`);

  // 1.1 Bad email on register
  const badEmailRes = await fetch(`${BASE_URL}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Test User', email: 'not-an-email', password: 'password123' }),
  });
  const badEmailData = await badEmailRes.json();
  assertCheck(
    'Register rejects invalid email format (400)',
    badEmailRes.status === 400 && typeof badEmailData.error === 'string' && badEmailData.error.includes('email'),
    `Status ${badEmailRes.status}: "${badEmailData.error}"`
  );

  // 1.2 Short password on register (< 8 chars)
  const shortPassRes = await fetch(`${BASE_URL}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Test User', email: 'valid@example.com', password: 'short' }),
  });
  const shortPassData = await shortPassRes.json();
  assertCheck(
    'Register rejects short password < 8 chars (400)',
    shortPassRes.status === 400 && typeof shortPassData.error === 'string',
    `Status ${shortPassRes.status}: "${shortPassData.error}"`
  );

  // 1.3 Long password on register (> 72 chars)
  const longPassRes = await fetch(`${BASE_URL}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Test User', email: 'valid@example.com', password: 'a'.repeat(80) }),
  });
  const longPassData = await longPassRes.json();
  assertCheck(
    'Register rejects password > 72 chars (400)',
    longPassRes.status === 400 && typeof longPassData.error === 'string',
    `Status ${longPassRes.status}: "${longPassData.error}"`
  );

  // 1.4 Empty name on register
  const emptyNameRes = await fetch(`${BASE_URL}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: '   ', email: 'valid@example.com', password: 'password123' }),
  });
  const emptyNameData = await emptyNameRes.json();
  assertCheck(
    'Register rejects whitespace/empty name (400)',
    emptyNameRes.status === 400 && typeof emptyNameData.error === 'string',
    `Status ${emptyNameRes.status}: "${emptyNameData.error}"`
  );

  // 1.5 Malformed non-JSON body payload
  const malformedJsonRes = await fetch(`${BASE_URL}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{"brokenJson: invalid',
  });
  const malformedJsonData = await malformedJsonRes.json();
  assertCheck(
    'Endpoint safely handles malformed JSON without 500 crash (400)',
    malformedJsonRes.status === 400 && malformedJsonData.error === 'Invalid JSON in request body',
    `Status ${malformedJsonRes.status}: "${malformedJsonData.error}"`
  );

  // SECTION 2: Authenticated Route Validation
  console.log(`\n--- Section 2: Authenticated Route Validation ---`);
  console.log(`Signing in as test user alex@example.com...`);
  const alexCookie = await login('alex@example.com', 'password123', BASE_URL);

  // 2.1 Messages: empty content
  const emptyMsgRes = await fetch(`${BASE_URL}/api/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: alexCookie },
    body: JSON.stringify({ matchId: 'some-match-id', content: '   ' }),
  });
  const emptyMsgData = await emptyMsgRes.json();
  assertCheck(
    'Messages rejects whitespace/empty content (400)',
    emptyMsgRes.status === 400 && typeof emptyMsgData.error === 'string',
    `Status ${emptyMsgRes.status}: "${emptyMsgData.error}"`
  );

  // 2.2 Messages: message > 2000 chars
  const longMsgRes = await fetch(`${BASE_URL}/api/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: alexCookie },
    body: JSON.stringify({ matchId: 'some-match-id', content: 'x'.repeat(2001) }),
  });
  const longMsgData = await longMsgRes.json();
  assertCheck(
    'Messages rejects message content > 2000 chars (400)',
    longMsgRes.status === 400 && typeof longMsgData.error === 'string',
    `Status ${longMsgRes.status}: "${longMsgData.error}"`
  );

  // 2.3 Messages: missing matchId in query
  const missingMatchQueryRes = await fetch(`${BASE_URL}/api/messages`, {
    headers: { Cookie: alexCookie },
  });
  const missingMatchQueryData = await missingMatchQueryRes.json();
  assertCheck(
    'GET /api/messages rejects missing matchId query parameter (400)',
    missingMatchQueryRes.status === 400 && typeof missingMatchQueryData.error === 'string',
    `Status ${missingMatchQueryRes.status}: "${missingMatchQueryData.error}"`
  );

  // 2.4 Reviews: missing toUserId in query
  const missingReviewQueryRes = await fetch(`${BASE_URL}/api/reviews`, {
    headers: { Cookie: alexCookie },
  });
  const missingReviewQueryData = await missingReviewQueryRes.json();
  assertCheck(
    'GET /api/reviews rejects missing toUserId query parameter (400)',
    missingReviewQueryRes.status === 400 && typeof missingReviewQueryData.error === 'string',
    `Status ${missingReviewQueryRes.status}: "${missingReviewQueryData.error}"`
  );

  // 2.5 Reviews: rating 0 (< 1)
  const lowRatingRes = await fetch(`${BASE_URL}/api/reviews`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: alexCookie },
    body: JSON.stringify({ toUserId: 'dummy', rating: 0, comment: 'Test comment' }),
  });
  const lowRatingData = await lowRatingRes.json();
  assertCheck(
    'Reviews rejects rating 0 (400)',
    lowRatingRes.status === 400 && typeof lowRatingData.error === 'string',
    `Status ${lowRatingRes.status}: "${lowRatingData.error}"`
  );

  // 2.6 Reviews: rating 6 (> 5)
  const highRatingRes = await fetch(`${BASE_URL}/api/reviews`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: alexCookie },
    body: JSON.stringify({ toUserId: 'dummy', rating: 6, comment: 'Test comment' }),
  });
  const highRatingData = await highRatingRes.json();
  assertCheck(
    'Reviews rejects rating 6 (400)',
    highRatingRes.status === 400 && typeof highRatingData.error === 'string',
    `Status ${highRatingRes.status}: "${highRatingData.error}"`
  );

  // 2.7 Reviews: non-integer rating
  const floatRatingRes = await fetch(`${BASE_URL}/api/reviews`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: alexCookie },
    body: JSON.stringify({ toUserId: 'dummy', rating: 4.5, comment: 'Test comment' }),
  });
  const floatRatingData = await floatRatingRes.json();
  assertCheck(
    'Reviews rejects non-integer rating (400)',
    floatRatingRes.status === 400 && typeof floatRatingData.error === 'string',
    `Status ${floatRatingRes.status}: "${floatRatingData.error}"`
  );

  // 2.8 Reviews: missing comment
  const missingCommentRes = await fetch(`${BASE_URL}/api/reviews`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: alexCookie },
    body: JSON.stringify({ toUserId: 'dummy', rating: 5, comment: '   ' }),
  });
  const missingCommentData = await missingCommentRes.json();
  assertCheck(
    'Reviews rejects whitespace/empty comment (400)',
    missingCommentRes.status === 400 && typeof missingCommentData.error === 'string',
    `Status ${missingCommentRes.status}: "${missingCommentData.error}"`
  );

  // 2.9 Reviews: comment > 1000 chars
  const longCommentRes = await fetch(`${BASE_URL}/api/reviews`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: alexCookie },
    body: JSON.stringify({ toUserId: 'dummy', rating: 5, comment: 'c'.repeat(1001) }),
  });
  const longCommentData = await longCommentRes.json();
  assertCheck(
    'Reviews rejects comment > 1000 chars (400)',
    longCommentRes.status === 400 && typeof longCommentData.error === 'string',
    `Status ${longCommentRes.status}: "${longCommentData.error}"`
  );

  // 2.10 Events: invalid latitude (> 90)
  const badLatRes = await fetch(`${BASE_URL}/api/events`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: alexCookie },
    body: JSON.stringify({
      title: 'Meetup',
      description: 'Description',
      location: 'Location',
      dateTime: '2026-10-25T10:00:00Z',
      lat: 999,
    }),
  });
  const badLatData = await badLatRes.json();
  assertCheck(
    'Events rejects latitude > 90 (400)',
    badLatRes.status === 400 && typeof badLatData.error === 'string' && badLatData.error.includes('Latitude'),
    `Status ${badLatRes.status}: "${badLatData.error}"`
  );

  // 2.11 Events: invalid longitude (> 180)
  const badLngRes = await fetch(`${BASE_URL}/api/events`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: alexCookie },
    body: JSON.stringify({
      title: 'Meetup',
      description: 'Description',
      location: 'Location',
      dateTime: '2026-10-25T10:00:00Z',
      lng: 999,
    }),
  });
  const badLngData = await badLngRes.json();
  assertCheck(
    'Events rejects longitude > 180 (400)',
    badLngRes.status === 400 && typeof badLngData.error === 'string' && badLngData.error.includes('Longitude'),
    `Status ${badLngRes.status}: "${badLngData.error}"`
  );

  // 2.12 Events: invalid date
  const badDateRes = await fetch(`${BASE_URL}/api/events`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: alexCookie },
    body: JSON.stringify({
      title: 'Meetup',
      description: 'Description',
      location: 'Location',
      dateTime: 'not-a-valid-date',
    }),
  });
  const badDateData = await badDateRes.json();
  assertCheck(
    'Events rejects invalid date format (400)',
    badDateRes.status === 400 && typeof badDateData.error === 'string',
    `Status ${badDateRes.status}: "${badDateData.error}"`
  );

  // 2.13 Skills: invalid category
  const badCategoryRes = await fetch(`${BASE_URL}/api/skills`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: alexCookie },
    body: JSON.stringify({ name: 'TestSkill', category: 'InvalidCategory' }),
  });
  const badCategoryData = await badCategoryRes.json();
  assertCheck(
    'Skills rejects unknown category (400)',
    badCategoryRes.status === 400 && typeof badCategoryData.error === 'string',
    `Status ${badCategoryRes.status}: "${badCategoryData.error}"`
  );

  // 2.14 Profile: bio > 500 chars
  const longBioRes = await fetch(`${BASE_URL}/api/user/profile`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Cookie: alexCookie },
    body: JSON.stringify({ bio: 'b'.repeat(501) }),
  });
  const longBioData = await longBioRes.json();
  assertCheck(
    'Profile rejects bio > 500 chars (400)',
    longBioRes.status === 400 && typeof longBioData.error === 'string',
    `Status ${longBioRes.status}: "${longBioData.error}"`
  );

  // 2.15 Profile: invalid avatar URL
  const badAvatarRes = await fetch(`${BASE_URL}/api/user/profile`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Cookie: alexCookie },
    body: JSON.stringify({ avatarUrl: 'not-a-valid-url' }),
  });
  const badAvatarData = await badAvatarRes.json();
  assertCheck(
    'Profile rejects invalid avatar URL format (400)',
    badAvatarRes.status === 400 && typeof badAvatarData.error === 'string',
    `Status ${badAvatarRes.status}: "${badAvatarData.error}"`
  );

  // 2.16 Profile: unknown proficiency level
  const badProficiencyRes = await fetch(`${BASE_URL}/api/user/profile`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Cookie: alexCookie },
    body: JSON.stringify({
      skillsTeach: [{ name: 'JavaScript', proficiency: 'Grandmaster' }],
    }),
  });
  const badProficiencyData = await badProficiencyRes.json();
  assertCheck(
    'Profile rejects invalid skill proficiency level (400)',
    badProficiencyRes.status === 400 && typeof badProficiencyData.error === 'string',
    `Status ${badProficiencyRes.status}: "${badProficiencyData.error}"`
  );

  // 2.17 Matches: invalid status on PATCH
  const badStatusRes = await fetch(`${BASE_URL}/api/matches/dummy-match-id`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Cookie: alexCookie },
    body: JSON.stringify({ status: 'INVALID_STATUS' }),
  });
  const badStatusData = await badStatusRes.json();
  assertCheck(
    'PATCH /api/matches/:id rejects invalid status (400)',
    badStatusRes.status === 400 && typeof badStatusData.error === 'string',
    `Status ${badStatusRes.status}: "${badStatusData.error}"`
  );

  // 2.18 Matches: empty targetUserId on POST
  const emptyTargetRes = await fetch(`${BASE_URL}/api/matches`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: alexCookie },
    body: JSON.stringify({ targetUserId: '   ' }),
  });
  const emptyTargetData = await emptyTargetRes.json();
  assertCheck(
    'POST /api/matches rejects whitespace/empty targetUserId (400)',
    emptyTargetRes.status === 400 && typeof emptyTargetData.error === 'string',
    `Status ${emptyTargetRes.status}: "${emptyTargetData.error}"`
  );

  // SECTION 3: Task P2.3-Fix: UUID Format & Email Normalization Verification
  console.log(`\n--- Section 3: UUID ID Format & Email Casing Verification ---`);

  // 3.1 Real UUID passes GET /api/messages query validation (200 OK)
  const realMatchUuidRes = await fetch(
    `${BASE_URL}/api/messages?matchId=06cf5119-ea31-4fd4-96b4-a8ce75833237`,
    { headers: { Cookie: alexCookie } }
  );
  assertCheck(
    'GET /api/messages with valid real UUID passes validation (200)',
    realMatchUuidRes.status === 200,
    `Status ${realMatchUuidRes.status}`
  );

  // 3.2 Real UUID passes GET /api/reviews query validation (200 OK)
  const realReviewUuidRes = await fetch(
    `${BASE_URL}/api/reviews?toUserId=a22dc032-5737-42ba-b356-2b7eb49dbeda`,
    { headers: { Cookie: alexCookie } }
  );
  assertCheck(
    'GET /api/reviews with valid real user UUID passes validation (200)',
    realReviewUuidRes.status === 200,
    `Status ${realReviewUuidRes.status}`
  );

  // 3.3 Unknown valid UUID passes Zod query validation without 400 (reaches 404/403 business logic)
  const unknownUuidRes = await fetch(
    `${BASE_URL}/api/messages?matchId=00000000-0000-0000-0000-000000000000`,
    { headers: { Cookie: alexCookie } }
  );
  assertCheck(
    'GET /api/messages with unknown UUID passes Zod validation (non-400)',
    unknownUuidRes.status === 404,
    `Status ${unknownUuidRes.status} (Not Found, not 400 validation error)`
  );

  // 3.4 Email casing: Login succeeds with UPPERCASE email
  let uppercaseLoginPassed = false;
  try {
    const uppercaseCookie = await login('ALEX@EXAMPLE.COM', 'password123', BASE_URL);
    const sessionRes = await fetch(`${BASE_URL}/api/auth/session`, {
      headers: { Cookie: uppercaseCookie },
    });
    const sessionData = await sessionRes.json();
    uppercaseLoginPassed = sessionData?.user?.email === 'alex@example.com';
  } catch {
    uppercaseLoginPassed = false;
  }
  assertCheck(
    'Credentials login normalizes uppercase email (ALEX@EXAMPLE.COM)',
    uppercaseLoginPassed,
    'Signed in successfully and normalized to lowercase session email'
  );

  // 3.5 Email casing: Login succeeds with Mixed-Case email
  let mixedCaseLoginPassed = false;
  try {
    const mixedCookie = await login('Alex@Example.Com', 'password123', BASE_URL);
    const sessionRes = await fetch(`${BASE_URL}/api/auth/session`, {
      headers: { Cookie: mixedCookie },
    });
    const sessionData = await sessionRes.json();
    mixedCaseLoginPassed = sessionData?.user?.email === 'alex@example.com';
  } catch {
    mixedCaseLoginPassed = false;
  }
  assertCheck(
    'Credentials login normalizes mixed-case email (Alex@Example.Com)',
    mixedCaseLoginPassed,
    'Signed in successfully and normalized to lowercase session email'
  );

  console.log(`\n======================================================`);
  console.log(`Validation Checks Complete: ${passCount} PASSED, ${failCount} FAILED`);
  console.log(`======================================================\n`);

  if (failCount > 0) {
    process.exit(1);
  }
}

run().catch((err) => {
  console.error('Validation check script error:', err);
  process.exit(1);
});

