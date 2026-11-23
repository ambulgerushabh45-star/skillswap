// server/scripts/avatar-check.mjs
// Automated verification script for Avatar Upload & Security (Express)
// Rejection and read-only checks only against http://localhost:4000 (no database rows or files created)

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

async function runAvatarChecks() {
  console.log(`\n======================================================`);
  console.log(`Starting SkillSwap Avatar Upload & Security Checks on ${BASE_URL}`);
  console.log(`======================================================\n`);

  // Section 1: Unauthenticated Checks (401)
  console.log('--- 1. Authentication Guards (401) ---');

  const unauthPost = await fetch(`${BASE_URL}/api/user/avatar`, {
    method: 'POST',
  });
  assertCheck('Unauthenticated POST /api/user/avatar returns 401', unauthPost.status === 401, `Status: ${unauthPost.status}`);

  const unauthDelete = await fetch(`${BASE_URL}/api/user/avatar`, {
    method: 'DELETE',
  });
  assertCheck('Unauthenticated DELETE /api/user/avatar returns 401', unauthDelete.status === 401, `Status: ${unauthDelete.status}`);

  const unauthGet = await fetch(`${BASE_URL}/api/avatars/35a575ce-0109-4591-9f5e-97bb9b100442-0123456789abcdef.webp`);
  assertCheck('Unauthenticated GET /api/avatars/[file] returns 401', unauthGet.status === 401, `Status: ${unauthGet.status}`);

  // Load test users
  const alex = await prisma.user.findUnique({ where: { email: 'alex@example.com' } });
  const rimi = await prisma.user.findUnique({ where: { email: 'rimi@gmail.com' } });

  if (!alex || !rimi) {
    console.error('Test users alex@example.com or rimi@gmail.com not found in database.');
    process.exit(1);
  }

  const alexCookie = getSessionCookie(alex.id);
  const rimiCookie = getSessionCookie(rimi.id);

  // Section 2: Avatar File Retrieval & Path Traversal Guards (GET /api/avatars/[file])
  console.log('\n--- 2. File Retrieval & Path Traversal Guards (GET) ---');

  // Traversal with ..
  const traversalRes1 = await fetch(`${BASE_URL}/api/avatars/..%2fsecret.webp`, {
    headers: { Cookie: alexCookie },
  });
  assertCheck('GET /api/avatars with encoded traversal returns 400', traversalRes1.status === 400, `Status: ${traversalRes1.status}`);

  // Invalid filename (not matching strict UUID-hex.webp pattern)
  const invalidNameRes = await fetch(`${BASE_URL}/api/avatars/invalid-filename.png`, {
    headers: { Cookie: alexCookie },
  });
  assertCheck('GET /api/avatars with invalid filename returns 400', invalidNameRes.status === 400, `Status: ${invalidNameRes.status}`);

  // Non-existent well-formed avatar
  const notFoundRes = await fetch(`${BASE_URL}/api/avatars/00000000-0000-0000-0000-000000000000-0123456789abcdef.webp`, {
    headers: { Cookie: alexCookie },
  });
  assertCheck('GET /api/avatars with well-formed non-existent file returns 404', notFoundRes.status === 404, `Status: ${notFoundRes.status}`);

  // Section 3: Upload Rejections (POST /api/user/avatar)
  console.log('\n--- 3. Upload Rejections & Content Type Checks (POST) ---');

  // Missing file in form data
  const emptyForm = new FormData();
  const emptyPostRes = await fetch(`${BASE_URL}/api/user/avatar`, {
    method: 'POST',
    headers: { Cookie: alexCookie },
    body: emptyForm,
  });
  assertCheck('POST /api/user/avatar without file field returns 400', emptyPostRes.status === 400, `Status: ${emptyPostRes.status}`);

  // Fake image (text file renamed photo.png)
  const fakeForm = new FormData();
  fakeForm.append('file', new Blob(['This is a plain text file, not a real image.'], { type: 'image/png' }), 'photo.png');
  const fakeImgRes = await fetch(`${BASE_URL}/api/user/avatar`, {
    method: 'POST',
    headers: { Cookie: alexCookie },
    body: fakeForm,
  });
  assertCheck(
    'POST /api/user/avatar with fake text-as-PNG returns 400/415',
    fakeImgRes.status === 400 || fakeImgRes.status === 415,
    `Status: ${fakeImgRes.status}`
  );

  // SVG file rejection (script injection vector)
  const svgForm = new FormData();
  svgForm.append(
    'file',
    new Blob(["<svg xmlns='http://www.w3.org/2000/svg'><script>alert('xss')</script></svg>"], { type: 'image/svg+xml' }),
    'avatar.svg'
  );
  const svgRes = await fetch(`${BASE_URL}/api/user/avatar`, {
    method: 'POST',
    headers: { Cookie: alexCookie },
    body: svgForm,
  });
  assertCheck(
    'POST /api/user/avatar with SVG upload is rejected with 400/415',
    svgRes.status === 400 || svgRes.status === 415,
    `Status: ${svgRes.status}`
  );

  // Payload over size limit (> 2.5 MB)
  const hugeBuffer = Buffer.alloc(2.7 * 1024 * 1024, 0x00);
  const hugeForm = new FormData();
  hugeForm.append('file', new Blob([hugeBuffer], { type: 'image/jpeg' }), 'huge.jpg');
  const hugeRes = await fetch(`${BASE_URL}/api/user/avatar`, {
    method: 'POST',
    headers: { Cookie: alexCookie },
    body: hugeForm,
  });
  assertCheck(
    'POST /api/user/avatar over size limit returns 413 or 400',
    hugeRes.status === 413 || hugeRes.status === 400,
    `Status: ${hugeRes.status}`
  );

  // Section 4: Profile PUT Ownership & Path Validation
  console.log('\n--- 4. Profile PUT Ownership & Traversal Validation ---');

  // Traversal / absolute path in avatarUrl
  const passwdRes = await fetch(`${BASE_URL}/api/user/profile`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Cookie: alexCookie },
    body: JSON.stringify({ avatarUrl: '/etc/passwd' }),
  });
  assertCheck("PUT /api/user/profile with '/etc/passwd' avatarUrl returns 400", passwdRes.status === 400, `Status: ${passwdRes.status}`);

  // Invalid path format
  const malformedPathRes = await fetch(`${BASE_URL}/api/user/profile`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Cookie: alexCookie },
    body: JSON.stringify({ avatarUrl: '/api/avatars/../evil.webp' }),
  });
  assertCheck('PUT /api/user/profile with traversal avatarUrl returns 400', malformedPathRes.status === 400, `Status: ${malformedPathRes.status}`);

  // Alex attempting to claim Rimi's avatar path
  const rimiAvatarPath = `/api/avatars/${rimi.id}-0123456789abcdef.webp`;
  const stealAvatarRes = await fetch(`${BASE_URL}/api/user/profile`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Cookie: alexCookie },
    body: JSON.stringify({ avatarUrl: rimiAvatarPath }),
  });
  assertCheck("Alex cannot claim Rimi's avatar path in PUT /api/user/profile (400)", stealAvatarRes.status === 400, `Status: ${stealAvatarRes.status}`);

  // Rimi attempting to claim Alex's avatar path
  const alexAvatarPath = `/api/avatars/${alex.id}-0123456789abcdef.webp`;
  const stealAvatarRes2 = await fetch(`${BASE_URL}/api/user/profile`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Cookie: rimiCookie },
    body: JSON.stringify({ avatarUrl: alexAvatarPath }),
  });
  assertCheck("Rimi cannot claim Alex's avatar path in PUT /api/user/profile (400)", stealAvatarRes2.status === 400, `Status: ${stealAvatarRes2.status}`);

  // Final Summary
  console.log(`\n======================================================`);
  console.log(`Avatar Check Results: ${passed} passed, ${failed} failed`);
  console.log(`======================================================\n`);

  await prisma.$disconnect();

  if (failed > 0) {
    process.exit(1);
  }
}

runAvatarChecks().catch((err) => {
  console.error('Fatal error during avatar checks:', err);
  prisma.$disconnect();
  process.exit(1);
});

