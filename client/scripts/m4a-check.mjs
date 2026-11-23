// client/scripts/m4a-check.mjs
// Automated verification script for Task M4a (chat, reviews, profile setup, geocoding)
// Runs through Vite proxy on http://localhost:5173.
// ZERO database mutations: read-only queries and negative validation/rejection assertions only.

import { prisma } from '../../server/src/db/prisma.js';

const CLIENT_BASE = process.env.CLIENT_URL || 'http://localhost:5173';
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

async function runM4aCheck() {
  console.log(`========================================================`);
  console.log(`Starting Task M4a Real-Server Verification on ${CLIENT_BASE}`);
  console.log(`========================================================\n`);

  let sessionCookie = '';
  let alexUser = null;
  let priyaUser = null;
  let activeMatch = null;

  try {
    // 1. SPA Route Fallbacks
    console.log('[1/6] Verifying React SPA HTML routing fallbacks...');
    for (const route of ['/chat', '/reviews', '/profile/setup', '/events']) {
      const res = await fetch(`${CLIENT_BASE}${route}`);
      assert(res.status === 200, `GET ${route} returns status 200`);
      const html = await res.text();
      assert(
        html.includes('id="root"'),
        `GET ${route} HTML contains <div id="root">`
      );
    }

    // 2. Authentication through Vite Proxy
    console.log('\n[2/6] Authenticating as alex@example.com through Vite proxy...');
    const loginRes = await fetch(`${CLIENT_BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'alex@example.com',
        password: 'password123',
      }),
    });
    assert(loginRes.status === 200, `POST /api/auth/login returned 200`);
    const setCookieHeader = loginRes.headers.get('set-cookie');
    assert(
      setCookieHeader && setCookieHeader.includes('skillswap_session='),
      `Set-Cookie header sets skillswap_session cookie`
    );
    sessionCookie = setCookieHeader.split(';')[0];

    const loginData = await loginRes.json();
    alexUser = loginData.user;
    assert(alexUser?.email === 'alex@example.com', `Logged in as Alex Johnson`);

    // 3. Chat & Conversations Verification
    console.log('\n[3/6] Verifying Chat and Conversations proxy endpoints...');
    const convsRes = await fetch(`${CLIENT_BASE}/api/conversations`, {
      headers: { Cookie: sessionCookie },
    });
    assert(convsRes.status === 200, `GET /api/conversations returns 200`);
    const convsData = await convsRes.json();
    assert(
      Array.isArray(convsData.conversations),
      `GET /api/conversations returns conversations array`
    );
    assert(
      Boolean(convsData.pagination),
      `GET /api/conversations includes pagination object`
    );

    if (convsData.conversations.length > 0) {
      activeMatch = convsData.conversations[0];
      const msgsRes = await fetch(
        `${CLIENT_BASE}/api/messages?matchId=${activeMatch.matchId}`,
        {
          headers: { Cookie: sessionCookie },
        }
      );
      assert(
        msgsRes.status === 200,
        `GET /api/messages for owned match returns 200`
      );
      const msgsData = await msgsRes.json();
      assert(
        Array.isArray(msgsData.messages),
        `GET /api/messages returns messages array`
      );
    }

    // Unauthorized match access rejection
    const invalidMsgsRes = await fetch(
      `${CLIENT_BASE}/api/messages?matchId=unowned-match-uuid`,
      {
        headers: { Cookie: sessionCookie },
      }
    );
    assert(
      invalidMsgsRes.status === 403 || invalidMsgsRes.status === 404,
      `GET /api/messages for unowned match rejected with 403 or 404 (got ${invalidMsgsRes.status})`
    );

    // Empty message content validation rejection (0 DB mutation)
    const emptyMsgRes = await fetch(`${CLIENT_BASE}/api/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: sessionCookie,
      },
      body: JSON.stringify({
        matchId: activeMatch?.matchId || 'some-match',
        content: '   ',
      }),
    });
    assert(
      emptyMsgRes.status === 400,
      `POST /api/messages with empty content rejected with 400`
    );

    // 4. Reviews Verification & Duplicate Rejection
    console.log('\n[4/6] Verifying Reviews proxy endpoints...');
    const seededReview = await prisma.review.findFirst({
      where: { fromUserId: alexUser.id },
      include: {
        toUser: { select: { id: true, name: true, email: true } },
      },
    });
    assert(Boolean(seededReview?.toUser), `Found seeded target peer for Alex in DB`);
    priyaUser = seededReview.toUser;

    const reviewsRes = await fetch(
      `${CLIENT_BASE}/api/reviews?toUserId=${priyaUser.id}`,
      {
        headers: { Cookie: sessionCookie },
      }
    );
    assert(reviewsRes.status === 200, `GET /api/reviews returns 200`);
    const reviewsData = await reviewsRes.json();
    assert(
      typeof reviewsData.avgRating === 'number',
      `GET /api/reviews returns numeric avgRating`
    );
    assert(
      Array.isArray(reviewsData.reviews),
      `GET /api/reviews returns reviews list`
    );

    // Rejection 1: Self-review (400)
    const selfReviewRes = await fetch(`${CLIENT_BASE}/api/reviews`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: sessionCookie,
      },
      body: JSON.stringify({
        toUserId: alexUser.id,
        rating: 5,
        comment: 'I am amazing at everything!',
      }),
    });
    assert(
      selfReviewRes.status === 400,
      `POST /api/reviews self-review rejected with 400 Bad Request`
    );

    // Rejection 2: Duplicate review for Priya (409 Conflict)
    const duplicateReviewRes = await fetch(`${CLIENT_BASE}/api/reviews`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: sessionCookie,
      },
      body: JSON.stringify({
        toUserId: priyaUser.id,
        rating: 5,
        comment: 'Second review attempt should fail.',
      }),
    });
    assert(
      duplicateReviewRes.status === 409,
      `POST /api/reviews duplicate review rejected with 409 Conflict`
    );

    // 5. Profile & Geocoding & Avatar Security
    console.log('\n[5/6] Verifying Profile, Geocoding, and Avatar proxy endpoints...');
    const profileRes = await fetch(`${CLIENT_BASE}/api/user/profile`, {
      headers: { Cookie: sessionCookie },
    });
    assert(profileRes.status === 200, `GET /api/user/profile returns 200`);
    const profileData = await profileRes.json();
    assert(
      profileData?.user?.email === 'alex@example.com',
      `Profile returns user data for Alex Johnson`
    );
    assert(
      profileData?.user?.passwordHash === undefined,
      `Profile does NOT leak passwordHash`
    );

    // Geocode query validation rejection (too short)
    const shortGeocodeRes = await fetch(`${CLIENT_BASE}/api/geocode?q=ab`, {
      headers: { Cookie: sessionCookie },
    });
    assert(
      shortGeocodeRes.status === 400,
      `GET /api/geocode?q=ab (< 3 chars) rejected with 400`
    );

    // Avatar path traversal rejection
    const traversalRes = await fetch(
      `${CLIENT_BASE}/api/avatars/..%2F..%2Fpackage.json`,
      {
        headers: { Cookie: sessionCookie },
      }
    );
    assert(
      traversalRes.status === 400 || traversalRes.status === 404,
      `GET /api/avatars/ with path traversal rejected with 400 or 404 (got ${traversalRes.status})`
    );

    // Avatar invalid upload rejection
    const fakeUploadFormData = new FormData();
    fakeUploadFormData.append(
      'file',
      new Blob(['not a real image'], { type: 'text/plain' }),
      'fake.txt'
    );
    const badUploadRes = await fetch(`${CLIENT_BASE}/api/user/avatar`, {
      method: 'POST',
      headers: { Cookie: sessionCookie },
      body: fakeUploadFormData,
    });
    assert(
      badUploadRes.status === 400,
      `POST /api/user/avatar with non-image file rejected with 400`
    );

    // 6. Database Integrity Check
    console.log('\n[6/6] Verifying Database Row Counts across all 9 tables...');
    const [
      usersCount,
      skillsCount,
      teachCount,
      learnCount,
      matchesCount,
      eventsCount,
      attendeesCount,
      reviewsCount,
      messagesCount,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.skill.count(),
      prisma.userSkillsTeach.count(),
      prisma.userSkillsLearn.count(),
      prisma.match.count(),
      prisma.event.count(),
      prisma.eventAttendee.count(),
      prisma.review.count(),
      prisma.message.count(),
    ]);

    const totalRows =
      usersCount +
      skillsCount +
      teachCount +
      learnCount +
      matchesCount +
      eventsCount +
      attendeesCount +
      reviewsCount +
      messagesCount;

    console.log(`  Table counts:`);
    console.log(`    User: ${usersCount}, Skill: ${skillsCount}, UserSkillsTeach: ${teachCount}, UserSkillsLearn: ${learnCount}`);
    console.log(`    Match: ${matchesCount}, Event: ${eventsCount}, EventAttendee: ${attendeesCount}, Review: ${reviewsCount}, Message: ${messagesCount}`);
    console.log(`    Total DB rows: ${totalRows}`);

    assert(
      totalRows === 81,
      `Database row count is strictly 81 across all 9 tables (got ${totalRows})`
    );
  } catch (err) {
    assert(false, `Unexpected error during M4a checks: ${err.message}`);
  } finally {
    await prisma.$disconnect();
  }

  console.log(`\n========================================================`);
  console.log(`Task M4a Verification Results: ${passed} Passed, ${failed} Failed`);
  console.log(`========================================================\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

runM4aCheck();
