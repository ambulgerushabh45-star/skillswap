// server/scripts/foundation-check.mjs
// Verification script for Task M1 foundation on http://localhost:4000
// CREATES NO DATA

const BASE_URL = 'http://localhost:4000';
let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    passed++;
    console.log(`  ✓ ${message}`);
  } else {
    failed++;
    console.error(`  ✗ FAIL: ${message}`);
  }
}

async function request(path, options = {}) {
  const url = `${BASE_URL}${path}`;
  const res = await fetch(url, options);
  let json = null;
  const text = await res.text();
  try {
    json = JSON.parse(text);
  } catch {
    // not json
  }
  return { res, json, text, status: res.status, headers: res.headers };
}

function extractCookie(res, cookieName) {
  const setCookie = res.headers.get('set-cookie');
  if (!setCookie) return null;
  const match = setCookie.match(new RegExp(`${cookieName}=([^;]+)`));
  return match ? match[1] : null;
}

async function runChecks() {
  console.log(`\n==============================================`);
  console.log(`Running Express Foundation Checks on ${BASE_URL}`);
  console.log(`==============================================\n`);

  // 1. Health check
  console.log('1. Health check:');
  const health = await request('/api/health');
  assert(health.status === 200, 'GET /api/health returns 200');
  assert(health.json?.status === 'ok', 'GET /api/health returns { status: "ok" }');

  // 2. Unauthenticated checks (401)
  console.log('\n2. Unauthenticated checks:');
  const unauthProfileGet = await request('/api/user/profile');
  assert(unauthProfileGet.status === 401, 'GET /api/user/profile without session returns 401');
  assert(unauthProfileGet.json?.error === 'Unauthorized', 'Error message is "Unauthorized"');

  const unauthProfilePut = await request('/api/user/profile', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ bio: 'test' }),
  });
  assert(unauthProfilePut.status === 401, 'PUT /api/user/profile without session returns 401');

  const unauthUserGet = await request('/api/users/35a575ce-0109-4591-9f5e-97bb9b100442');
  assert(unauthUserGet.status === 401, 'GET /api/users/:id without session returns 401');

  const unauthSkillsPost = await request('/api/skills', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Test Skill', category: 'General' }),
  });
  assert(unauthSkillsPost.status === 401, 'POST /api/skills without session returns 401');

  // 3. GET /api/auth/session without cookie
  console.log('\n3. Session when logged out:');
  const loggedOutSession = await request('/api/auth/session');
  assert(loggedOutSession.status === 200, 'GET /api/auth/session returns 200');
  assert(loggedOutSession.json?.user === null, 'Session user is null');

  // 4. Register rejection cases (creates NO user)
  console.log('\n4. Register rejection cases:');
  const regBadEmail = await request('/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Bob', email: 'notanemail', password: 'password123' }),
  });
  assert(regBadEmail.status === 400, 'Register bad email returns 400');

  const regShortPass = await request('/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Bob', email: 'bob@example.com', password: 'short' }),
  });
  assert(regShortPass.status === 400, 'Register short password (<8) returns 400');

  const regLongPass = await request('/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Bob', email: 'bob@example.com', password: 'a'.repeat(73) }),
  });
  assert(regLongPass.status === 400, 'Register long password (>72) returns 400');

  const regEmptyName = await request('/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: '   ', email: 'bob@example.com', password: 'password123' }),
  });
  assert(regEmptyName.status === 400, 'Register empty name returns 400');

  const regMalformedJson = await request('/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{ malformed: json',
  });
  assert(regMalformedJson.status === 400, 'Register malformed JSON returns 400');
  assert(regMalformedJson.json?.error === 'Invalid JSON in request body', 'Error is "Invalid JSON in request body"');

  // 5. Login for alex@example.com
  console.log('\n5. Login for alex@example.com:');
  const loginRes = await request('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'alex@example.com', password: 'password123' }),
  });
  assert(loginRes.status === 200, 'Login returns 200');
  assert(loginRes.json?.user?.name === 'Alex Kumar', 'User is Alex Kumar');
  assert(loginRes.json?.user?.passwordHash === undefined, 'No passwordHash in login response');

  const setCookie = loginRes.headers.get('set-cookie') || '';
  assert(setCookie.includes('skillswap_session='), 'Cookie skillswap_session is set');
  assert(/httponly/i.test(setCookie), 'Cookie is HttpOnly');
  assert(/samesite=lax/i.test(setCookie), 'Cookie has SameSite=Lax');

  const sessionToken = extractCookie(loginRes.res, 'skillswap_session');
  assert(Boolean(sessionToken), 'Session token extracted');

  // Verify session with cookie
  const authSession = await request('/api/auth/session', {
    headers: { Cookie: `skillswap_session=${sessionToken}` },
  });
  assert(authSession.status === 200, 'GET /api/auth/session with cookie returns 200');
  assert(authSession.json?.user?.email === 'alex@example.com', 'Session email is alex@example.com');
  assert(authSession.json?.user?.passwordHash === undefined, 'Session user has no passwordHash');

  // 6. Mixed-case email login
  console.log('\n6. Mixed-case email login:');
  const mixedLogin = await request('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'ALEX@EXAMPLE.COM', password: 'password123' }),
  });
  assert(mixedLogin.status === 200, 'Mixed-case email login returns 200');
  assert(mixedLogin.json?.user?.email === 'alex@example.com', 'User email normalized to lowercase');

  // 7. Wrong password
  console.log('\n7. Wrong password:');
  const wrongPassLogin = await request('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'alex@example.com', password: 'wrongpassword999' }),
  });
  assert(wrongPassLogin.status === 401, 'Wrong password returns 401');
  assert(wrongPassLogin.json?.error === 'Invalid email or password', 'Generic error message "Invalid email or password"');

  // 8. Tampered cookie
  console.log('\n8. Tampered cookie:');
  const tamperedSession = await request('/api/auth/session', {
    headers: { Cookie: 'skillswap_session=fake.tampered.token' },
  });
  assert(tamperedSession.status === 200, 'GET /api/auth/session with tampered cookie returns 200');
  assert(tamperedSession.json?.user === null, 'Tampered cookie yields user: null (logged out)');

  // 9. Foreign Origin header
  console.log('\n9. CSRF foreign Origin check:');
  const foreignOriginRes = await request('/api/skills', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: `skillswap_session=${sessionToken}`,
      Origin: 'http://malicious-attacker.com',
    },
    body: JSON.stringify({ name: 'Hacked Skill', category: 'General' }),
  });
  assert(foreignOriginRes.status === 403, 'Foreign Origin returns 403 Forbidden');
  assert(foreignOriginRes.json?.error === 'Invalid origin', 'Error is "Invalid origin"');

  // 10. Profile responses contain no passwordHash
  console.log('\n10. Profile safe selection:');
  const profileRes = await request('/api/user/profile', {
    headers: { Cookie: `skillswap_session=${sessionToken}` },
  });
  assert(profileRes.status === 200, 'GET /api/user/profile returns 200');
  assert(profileRes.json?.user?.passwordHash === undefined, 'user.passwordHash is undefined');
  assert(!profileRes.text.includes('passwordHash'), 'No "passwordHash" in profile response text');

  // 11. Public profile privacy check
  console.log('\n11. Public profile privacy check (/api/users/:id):');
  const userProfileRes = await request('/api/users/35a575ce-0109-4591-9f5e-97bb9b100442', {
    headers: { Cookie: `skillswap_session=${sessionToken}` },
  });
  assert(userProfileRes.status === 200, 'GET /api/users/:id returns 200');
  assert(!userProfileRes.text.includes('"email"'), 'No "email" in public profile response text');
  assert(!userProfileRes.text.includes('passwordHash'), 'No "passwordHash" in public profile response text');
  assert(!userProfileRes.text.includes('"latitude"'), 'No "latitude" in public profile response text');
  assert(!userProfileRes.text.includes('"longitude"'), 'No "longitude" in public profile response text');

  // Check user with zero reviews (ray)
  const zeroReviewUserRes = await request('/api/users/4e35baed-bf4a-4a07-920c-2f4254fdb742', {
    headers: { Cookie: `skillswap_session=${sessionToken}` },
  });
  assert(zeroReviewUserRes.status === 200, 'GET /api/users/:id for 0-review user returns 200');
  assert(zeroReviewUserRes.json?.rating?.average === null, 'rating.average is strictly null for 0 reviews');
  assert(zeroReviewUserRes.json?.rating?.count === 0, 'rating.count is 0');

  // 12. Unknown valid UUID
  console.log('\n12. Unknown valid UUID:');
  const unknownUserRes = await request('/api/users/00000000-0000-4000-8000-000000000000', {
    headers: { Cookie: `skillswap_session=${sessionToken}` },
  });
  assert(unknownUserRes.status === 404, 'Unknown UUID returns 404');
  assert(unknownUserRes.json?.error === 'User not found', 'Error is "User not found"');

  // 13. Profile PUT rejection cases
  console.log('\n13. Profile PUT rejection cases:');
  const longBioRes = await request('/api/user/profile', {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Cookie: `skillswap_session=${sessionToken}`,
    },
    body: JSON.stringify({ bio: 'a'.repeat(501) }),
  });
  assert(longBioRes.status === 400, 'Bio > 500 chars returns 400');

  const badAvatarRes = await request('/api/user/profile', {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Cookie: `skillswap_session=${sessionToken}`,
    },
    body: JSON.stringify({ avatarUrl: 'invalid-avatar-url' }),
  });
  assert(badAvatarRes.status === 400, 'Invalid avatarUrl format returns 400');

  const badProficiencyRes = await request('/api/user/profile', {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Cookie: `skillswap_session=${sessionToken}`,
    },
    body: JSON.stringify({
      skillsTeach: [{ name: 'Guitar', proficiency: 'Godlike' }],
    }),
  });
  assert(badProficiencyRes.status === 400, 'Invalid proficiency level returns 400');

  const stolenAvatarRes = await request('/api/user/profile', {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Cookie: `skillswap_session=${sessionToken}`,
    },
    body: JSON.stringify({
      avatarUrl: '/api/avatars/00000000-0000-0000-0000-000000000000-1234567890123456.webp',
    }),
  });
  assert(stolenAvatarRes.status === 400, "Another user's avatar path returns 400");
  assert(stolenAvatarRes.json?.error === "Cannot use another user's avatar", 'Error is "Cannot use another user\'s avatar"');

  // 14. Logout clears cookie
  console.log('\n14. Logout clears cookie:');
  const logoutRes = await request('/api/auth/logout', {
    method: 'POST',
    headers: { Cookie: `skillswap_session=${sessionToken}` },
  });
  assert(logoutRes.status === 200, 'POST /api/auth/logout returns 200');
  const logoutCookie = logoutRes.headers.get('set-cookie') || '';
  assert(
    logoutCookie.includes('skillswap_session=;') ||
    logoutCookie.includes('Expires=Thu, 01 Jan 1970') ||
    logoutCookie.includes('Max-Age=0'),
    'Logout response clears skillswap_session cookie'
  );

  // 15. Login rate limit (uses made-up email only)
  console.log('\n15. Login rate limit (per-email isolation):');
  const fakeEmail = `rate-test-${Date.now()}@example.com`;
  let rateLimitHit = false;
  let retryAfterSeconds = 0;

  for (let i = 1; i <= 11; i++) {
    const rlRes = await request('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: fakeEmail, password: 'wrongpassword' }),
    });

    if (rlRes.status === 429) {
      rateLimitHit = true;
      retryAfterSeconds = parseInt(rlRes.headers.get('retry-after') || '0', 10);
      assert(rlRes.json?.error?.includes('Too many login attempts'), 'Returns "Too many login attempts..." error');
      assert(retryAfterSeconds > 0, `Retry-After header present: ${retryAfterSeconds}s`);
      break;
    }
  }
  assert(rateLimitHit, 'Per-email login rate limit returns 429 on 11th attempt');

  // Verify different email from same machine is NOT blocked
  const differentEmail = `rate-test-other-${Date.now()}@example.com`;
  const diffEmailRes = await request('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: differentEmail, password: 'wrongpassword' }),
  });
  assert(
    diffEmailRes.status === 401,
    'Different email from same IP is NOT blocked by per-email limit (returns 401, not 429)'
  );

  console.log(`\nRate limit window duration: 900 seconds (15 minutes). Window resets in ~${retryAfterSeconds}s.`);

  console.log(`\n==============================================`);
  console.log(`Foundation Check Results: ${passed} passed, ${failed} failed`);
  console.log(`==============================================\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

runChecks().catch((err) => {
  console.error('Foundation check error:', err);
  process.exit(1);
});

