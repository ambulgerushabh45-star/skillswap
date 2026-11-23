// server/scripts/p35-check.mjs
// P3.5 Automated Verification Script (Rejection & Denial Checks only - zero DB mutations)

import { login, getSessionCookie } from './test-auth-helper.mjs';

const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:4000';

let passed = 0;
let failed = 0;

function assert(condition, message, detail = '') {
  if (condition) {
    passed++;
    console.log(`  ✓ ${message}${detail ? ` (${detail})` : ''}`);
  } else {
    failed++;
    console.error(`  ✗ ${message}${detail ? ` (${detail})` : ''}`);
  }
}

async function run() {
  console.log(`==============================================`);
  console.log(`Starting P3.5 Rejection & Denial Checks on ${BASE_URL}`);
  console.log(`==============================================\n`);

  const alexCookie = await login('alex@example.com');
  const rimiId = '236bd8b3-f28b-4381-bc18-fdc301cc8744';
  const rimiCookie = getSessionCookie(rimiId);

  // Get an existing event
  const eventsRes = await fetch(`${BASE_URL}/api/events`);
  assert(eventsRes.ok, 'GET /api/events returns 200');
  const eventsData = await eventsRes.json();
  const event = eventsData.events[0];
  assert(Boolean(event), 'At least one event exists in database', `Event ID: ${event?.id}`);

  // Determine host and non-host sessions for this event
  const isAlexHost = event.hostId === '35a575ce-0109-4591-9f5e-97bb9b100442';
  const hostCookie = isAlexHost ? alexCookie : rimiCookie;
  const nonHostCookie = isAlexHost ? rimiCookie : alexCookie;

  console.log(`\n--- 1. Authentication Guards (401) ---`);
  // 1.1 Unauthenticated PATCH
  const unauthPatch = await fetch(`${BASE_URL}/api/events/${event.id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title: 'New Title' }),
  });
  assert(unauthPatch.status === 401, 'PATCH /api/events/:id unauthenticated -> 401');

  // 1.2 Unauthenticated POST /cancel
  const unauthCancel = await fetch(`${BASE_URL}/api/events/${event.id}/cancel`, {
    method: 'POST',
  });
  assert(unauthCancel.status === 401, 'POST /api/events/:id/cancel unauthenticated -> 401');

  // 1.3 Unauthenticated POST /rsvp
  const unauthRsvp = await fetch(`${BASE_URL}/api/events/${event.id}/rsvp`, {
    method: 'POST',
  });
  assert(unauthRsvp.status === 401, 'POST /api/events/:id/rsvp unauthenticated -> 401');

  console.log(`\n--- 2. Authorization / Non-Host Guards (403) ---`);
  // 2.1 Non-host PATCH
  const nonHostPatch = await fetch(`${BASE_URL}/api/events/${event.id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Cookie: nonHostCookie },
    body: JSON.stringify({ title: 'Unauthorized Edit' }),
  });
  const nonHostPatchData = await nonHostPatch.json();
  assert(
    nonHostPatch.status === 403 && nonHostPatchData.error?.includes('host'),
    'Non-host PATCH /api/events/:id -> 403',
    nonHostPatchData.error
  );

  // 2.2 Non-host POST /cancel
  const nonHostCancel = await fetch(`${BASE_URL}/api/events/${event.id}/cancel`, {
    method: 'POST',
    headers: { Cookie: nonHostCookie },
  });
  const nonHostCancelData = await nonHostCancel.json();
  assert(
    nonHostCancel.status === 403 && nonHostCancelData.error?.includes('host'),
    'Non-host POST /api/events/:id/cancel -> 403',
    nonHostCancelData.error
  );

  console.log(`\n--- 3. Resource Not Found Guards (404) ---`);
  const fakeId = '00000000-0000-4000-8000-000000000000';

  // 3.1 Nonexistent event PATCH
  const missingPatch = await fetch(`${BASE_URL}/api/events/${fakeId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Cookie: hostCookie },
    body: JSON.stringify({ title: 'Edit non-existent' }),
  });
  assert(missingPatch.status === 404, 'Unknown event UUID PATCH -> 404');

  // 3.2 Nonexistent event cancel
  const missingCancel = await fetch(`${BASE_URL}/api/events/${fakeId}/cancel`, {
    method: 'POST',
    headers: { Cookie: hostCookie },
  });
  assert(missingCancel.status === 404, 'Unknown event UUID POST /cancel -> 404');

  // 3.3 Nonexistent event rsvp
  const missingRsvp = await fetch(`${BASE_URL}/api/events/${fakeId}/rsvp`, {
    method: 'POST',
    headers: { Cookie: hostCookie },
  });
  assert(missingRsvp.status === 404, 'Unknown event UUID POST /rsvp -> 404');

  console.log(`\n--- 4. Payload Validation Guards (400) ---`);
  // 4.1 Empty patch body
  const emptyPatch = await fetch(`${BASE_URL}/api/events/${event.id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Cookie: hostCookie },
    body: JSON.stringify({}),
  });
  assert(emptyPatch.status === 400, 'Empty PATCH payload rejected with 400');

  // 4.2 maxAttendees: 0 (< 1)
  const zeroCap = await fetch(`${BASE_URL}/api/events/${event.id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Cookie: hostCookie },
    body: JSON.stringify({ maxAttendees: 0 }),
  });
  assert(zeroCap.status === 400, 'maxAttendees < 1 rejected with 400');

  // 4.3 maxAttendees: 1001 (> 1000)
  const highCap = await fetch(`${BASE_URL}/api/events/${event.id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Cookie: hostCookie },
    body: JSON.stringify({ maxAttendees: 1001 }),
  });
  assert(highCap.status === 400, 'maxAttendees > 1000 rejected with 400');

  // 4.4 maxAttendees: float (non-integer)
  const floatCap = await fetch(`${BASE_URL}/api/events/${event.id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Cookie: hostCookie },
    body: JSON.stringify({ maxAttendees: 2.5 }),
  });
  assert(floatCap.status === 400, 'non-integer maxAttendees rejected with 400');

  // 4.5 Coordinates: latitude > 90
  const badLat = await fetch(`${BASE_URL}/api/events/${event.id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Cookie: hostCookie },
    body: JSON.stringify({ lat: 91 }),
  });
  assert(badLat.status === 400, 'Latitude > 90 rejected with 400');

  // 4.6 Coordinates: latitude < -90
  const badLatLow = await fetch(`${BASE_URL}/api/events/${event.id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Cookie: hostCookie },
    body: JSON.stringify({ lat: -91 }),
  });
  assert(badLatLow.status === 400, 'Latitude < -90 rejected with 400');

  // 4.7 Coordinates: longitude > 180
  const badLng = await fetch(`${BASE_URL}/api/events/${event.id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Cookie: hostCookie },
    body: JSON.stringify({ lng: 181 }),
  });
  assert(badLng.status === 400, 'Longitude > 180 rejected with 400');

  // 4.8 Coordinates: longitude < -180
  const badLngLow = await fetch(`${BASE_URL}/api/events/${event.id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Cookie: hostCookie },
    body: JSON.stringify({ lng: -181 }),
  });
  assert(badLngLow.status === 400, 'Longitude < -180 rejected with 400');

  // 4.9 Invalid date format
  const badDate = await fetch(`${BASE_URL}/api/events/${event.id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Cookie: hostCookie },
    body: JSON.stringify({ dateTime: 'not-a-valid-date' }),
  });
  assert(badDate.status === 400, 'Invalid date format rejected with 400');

  console.log(`\n==============================================`);
  console.log(`P3.5 Check Summary: ${passed} passed, ${failed} failed`);
  console.log(`==============================================\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

run().catch((err) => {
  console.error('P3.5 check failed with error:', err);
  process.exit(1);
});

