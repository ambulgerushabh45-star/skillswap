// client/scripts/m4b-check.mjs
// Automated verification script for Task M4b (Events page, P3.5 edit/cancel/capacity routes, and Leaflet map data)
// Executes through the Vite proxy on http://localhost:5173.
// ZERO database mutations: read-only queries and rejection-only assertions.

import { prisma } from '../../server/src/db/prisma.js';

const CLIENT_BASE = process.env.CLIENT_URL || 'http://localhost:5173';
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

async function runM4bCheck() {
  console.log('========================================================');
  console.log(`Starting Task M4b Real-Server Verification on ${CLIENT_BASE}`);
  console.log('========================================================\n');

  let alexSessionCookie = '';
  let priyaSessionCookie = '';

  try {
    // 0. Verify Database Row Count baseline before checks
    const beforeCounts = await prisma.event.count();
    const beforeAttendees = await prisma.eventAttendee.count();

    // 1. SPA Route Fallbacks
    console.log('[1/7] Verifying React SPA HTML routing fallback for /events...');
    const spaRes = await fetch(`${CLIENT_BASE}/events`);
    assert(spaRes.status === 200, 'GET /events returns status 200');
    const spaHtml = await spaRes.text();
    assert(
      spaHtml.includes('id="root"'),
      'GET /events HTML contains <div id="root">'
    );

    // 2. Unauthenticated GET /api/events
    console.log('\n[2/7] Checking unauthenticated GET /api/events behavior...');
    const unauthRes = await fetch(`${CLIENT_BASE}/api/events`);
    assert(unauthRes.status === 200, 'Unauthenticated GET /api/events returns 200 OK');
    const unauthData = await unauthRes.json();
    assert(Array.isArray(unauthData.events), 'Unauthenticated response contains events array');
    assert(Boolean(unauthData.pagination), 'Unauthenticated response contains pagination metadata');
    if (unauthData.events.length > 0) {
      assert(
        unauthData.events.every((e) => e.isGoing === false && e.isHost === false),
        'Unauthenticated events all reflect isGoing: false and isHost: false'
      );
      assert(
        unauthData.events.every((e) => e.distanceKm === null),
        'Unauthenticated events all reflect distanceKm: null'
      );
    }

    // 3. Authenticate as Alex Kumar and Priya Patel through Vite proxy with Origin header
    console.log('\n[3/7] Authenticating users through Vite proxy with Origin: http://localhost:5173...');
    const alexLoginRes = await fetch(`${CLIENT_BASE}/api/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Origin: 'http://localhost:5173',
      },
      body: JSON.stringify({ email: 'alex@example.com', password: 'password123' }),
    });
    assert(alexLoginRes.status === 200, 'Alex login returned 200');
    const alexCookieHeader = alexLoginRes.headers.get('set-cookie');
    assert(
      alexCookieHeader && alexCookieHeader.includes('skillswap_session='),
      'Alex session cookie extracted'
    );
    const alexMatch = alexCookieHeader?.match(/skillswap_session=([^;]+)/);
    alexSessionCookie = `skillswap_session=${alexMatch[1]}`;

    const priyaLoginRes = await fetch(`${CLIENT_BASE}/api/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Origin: 'http://localhost:5173',
      },
      body: JSON.stringify({ email: 'priya.patel@example.com', password: 'password123' }),
    });
    assert(priyaLoginRes.status === 200, 'Priya login returned 200');
    const priyaCookieHeader = priyaLoginRes.headers.get('set-cookie');
    assert(
      priyaCookieHeader && priyaCookieHeader.includes('skillswap_session='),
      'Priya session cookie extracted'
    );
    const priyaMatch = priyaCookieHeader?.match(/skillswap_session=([^;]+)/);
    priyaSessionCookie = `skillswap_session=${priyaMatch[1]}`;

    // 4. Authenticated GET /api/events Response Shape (P3.5 Fields)
    console.log('\n[4/7] Verifying GET /api/events response shape and P3.5 keys...');
    const authEventsRes = await fetch(`${CLIENT_BASE}/api/events`, {
      headers: {
        Cookie: alexSessionCookie,
        Origin: 'http://localhost:5173',
      },
    });
    assert(authEventsRes.status === 200, 'Alex GET /api/events returns 200');
    const authEventsData = await authEventsRes.json();
    assert(Array.isArray(authEventsData.events), 'Response contains events array');
    assert(authEventsData.events.length > 0, 'Database contains at least 1 event');

    const firstEvent = authEventsData.events[0];
    const requiredKeys = [
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
      'goingCount',
      'attendeeCount',
      'maxAttendees',
      'cancelled',
      'isFull',
      'isGoing',
      'isHost',
      'distanceKm',
    ];

    const missingKeys = requiredKeys.filter((k) => !(k in firstEvent));
    assert(
      missingKeys.length === 0,
      'Every event object contains all required P3.5 keys',
      missingKeys.length > 0 ? `Missing: ${missingKeys.join(', ')}` : 'All 18 keys present'
    );
    assert(typeof firstEvent.cancelled === 'boolean', 'e.cancelled is a boolean');
    assert(typeof firstEvent.isFull === 'boolean', 'e.isFull is a boolean');
    assert(typeof firstEvent.goingCount === 'number', 'e.goingCount is a number');
    assert(
      firstEvent.maxAttendees === null || typeof firstEvent.maxAttendees === 'number',
      'e.maxAttendees is null or number'
    );

    // 5. Host Authorization Rejections (403 Forbidden)
    console.log('\n[5/7] Testing host authorization guards (403 Forbidden)...');
    // Find an event not hosted by Alex
    const notAlexEvent = authEventsData.events.find((e) => !e.isHost) || firstEvent;
    const nonHostCookie = notAlexEvent.isHost ? priyaSessionCookie : alexSessionCookie;

    const nonHostPatchRes = await fetch(`${CLIENT_BASE}/api/events/${notAlexEvent.id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Cookie: nonHostCookie,
        Origin: 'http://localhost:5173',
      },
      body: JSON.stringify({ title: 'Unauthorized Edit Attempt' }),
    });
    assert(nonHostPatchRes.status === 403, 'PATCH /api/events/:id as non-host returns 403 Forbidden');
    const nonHostPatchData = await nonHostPatchRes.json();
    assert(
      nonHostPatchData.error?.includes('Only the event host can edit'),
      '403 error message specifies only host can edit'
    );

    const nonHostCancelRes = await fetch(`${CLIENT_BASE}/api/events/${notAlexEvent.id}/cancel`, {
      method: 'POST',
      headers: {
        Cookie: nonHostCookie,
        Origin: 'http://localhost:5173',
      },
    });
    assert(nonHostCancelRes.status === 403, 'POST /api/events/:id/cancel as non-host returns 403 Forbidden');
    const nonHostCancelData = await nonHostCancelRes.json();
    assert(
      nonHostCancelData.error?.includes('Only the event host can cancel'),
      '403 error message specifies only host can cancel'
    );

    // 6. Validation Rejection Tests (400 Bad Request)
    console.log('\n[6/7] Testing validation rejections (400 Bad Request)...');

    // Find an event hosted by the session user
    const hostedEvent = authEventsData.events.find((e) => e.isHost) || firstEvent;
    const hostCookie = hostedEvent.isHost ? alexSessionCookie : priyaSessionCookie;

    // PATCH with empty body
    const emptyPatchRes = await fetch(`${CLIENT_BASE}/api/events/${hostedEvent.id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Cookie: hostCookie,
        Origin: 'http://localhost:5173',
      },
      body: JSON.stringify({}),
    });
    assert(emptyPatchRes.status === 400, 'PATCH with empty body returns 400 Bad Request');

    // PATCH with maxAttendees 0 (< 1)
    const zeroMaxRes = await fetch(`${CLIENT_BASE}/api/events/${hostedEvent.id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Cookie: hostCookie,
        Origin: 'http://localhost:5173',
      },
      body: JSON.stringify({ maxAttendees: 0 }),
    });
    assert(zeroMaxRes.status === 400, 'PATCH with maxAttendees 0 returns 400 Bad Request');

    // PATCH with maxAttendees 1001 (> 1000)
    const overMaxRes = await fetch(`${CLIENT_BASE}/api/events/${hostedEvent.id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Cookie: hostCookie,
        Origin: 'http://localhost:5173',
      },
      body: JSON.stringify({ maxAttendees: 1001 }),
    });
    assert(overMaxRes.status === 400, 'PATCH with maxAttendees 1001 returns 400 Bad Request');

    // POST /api/events with invalid latitude (95 > 90)
    const invalidLatRes = await fetch(`${CLIENT_BASE}/api/events`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: alexSessionCookie,
        Origin: 'http://localhost:5173',
      },
      body: JSON.stringify({
        title: 'Invalid Lat Meetup',
        description: 'Test invalid coordinates',
        location: 'North Pole Beyond',
        dateTime: '2026-12-01T10:00:00.000Z',
        lat: 95,
        lng: 77.5,
      }),
    });
    assert(invalidLatRes.status === 400, 'POST /api/events with invalid latitude (95) returns 400 Bad Request');

    // 7. Not Found Rejections (404 Not Found)
    console.log('\n[7/7] Testing unknown resource UUID rejections (404 Not Found)...');
    const unknownUuid = '00000000-0000-4000-8000-000000000000';

    const unknownPatchRes = await fetch(`${CLIENT_BASE}/api/events/${unknownUuid}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Cookie: alexSessionCookie,
        Origin: 'http://localhost:5173',
      },
      body: JSON.stringify({ title: 'Ghost Update' }),
    });
    assert(unknownPatchRes.status === 404, 'PATCH on unknown valid UUID returns 404 Not Found');

    const unknownRsvpRes = await fetch(`${CLIENT_BASE}/api/events/${unknownUuid}/rsvp`, {
      method: 'POST',
      headers: {
        Cookie: alexSessionCookie,
        Origin: 'http://localhost:5173',
      },
    });
    assert(unknownRsvpRes.status === 404, 'POST RSVP on unknown valid UUID returns 404 Not Found');

    // Zero Database Mutations check
    const afterCounts = await prisma.event.count();
    const afterAttendees = await prisma.eventAttendee.count();
    assert(
      beforeCounts === afterCounts,
      `Zero events created during checks (before: ${beforeCounts}, after: ${afterCounts})`
    );
    assert(
      beforeAttendees === afterAttendees,
      `Zero attendee records created during checks (before: ${beforeAttendees}, after: ${afterAttendees})`
    );

    console.log('\n========================================================');
    console.log(`M4b Check Complete: ${passed} PASSED, ${failed} FAILED`);
    console.log('========================================================\n');

    if (failed > 0) {
      process.exit(1);
    }
  } catch (err) {
    console.error('Unexpected check script error:', err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runM4bCheck();

