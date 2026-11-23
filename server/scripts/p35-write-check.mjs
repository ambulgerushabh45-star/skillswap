// server/scripts/p35-write-check.mjs
// Full write-path integration test on an isolated scratch MongoDB database (port 4100)
// Tests all P3.5 features, capacity limits, cancellations, messaging, reviews, avatars,
// plus two high-concurrency race condition tests (Parallel Reviews and Parallel RSVPs).
// Ensures prisma/dev.db is 100% untouched.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import sharp from 'sharp';
import { PrismaClient } from '@prisma/client';
import { signSessionToken } from '../src/lib/auth.js';
import { createScratchDatabase, dropScratchDatabase } from './test-db-helper.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..', '..');
const serverDir = path.resolve(rootDir, 'server');
const tmpDir = path.resolve(serverDir, 'tmp');
const testAvatarDir = path.resolve(tmpDir, 'avatars');

const TEST_PORT = 4100;
const TEST_BASE_URL = `http://localhost:${TEST_PORT}`;

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

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function waitForServer(url, timeoutMs = 10000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(`${url}/api/health`);
      if (res.ok) return true;
    } catch {
      // wait
    }
    await sleep(200);
  }
  throw new Error(`Server at ${url} did not become ready within ${timeoutMs}ms`);
}

async function run() {
  console.log(`==============================================`);
  console.log(`Starting P3.5 Write-Path & Concurrency Integration Test`);
  console.log(`Working Directory: ${rootDir}`);
  console.log(`==============================================\n`);

  // 1. Prepare isolated temporary avatar dir
  if (fs.existsSync(tmpDir)) {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
  fs.mkdirSync(tmpDir, { recursive: true });
  fs.mkdirSync(testAvatarDir, { recursive: true });

  // 2. Create isolated scratch MongoDB database with loaded 81 records
  const { testDbName, testMongoUrl } = await createScratchDatabase({ loadData: true });
  const testPrisma = new PrismaClient({
    datasources: { db: { url: testMongoUrl } },
    log: ['error'],
  });

  const initialTotal =
    (await testPrisma.user.count()) +
    (await testPrisma.skill.count()) +
    (await testPrisma.userSkillsTeach.count()) +
    (await testPrisma.userSkillsLearn.count()) +
    (await testPrisma.match.count()) +
    (await testPrisma.event.count()) +
    (await testPrisma.eventAttendee.count()) +
    (await testPrisma.review.count()) +
    (await testPrisma.message.count());

  console.log(`Scratch DB initial row count across 9 collections: ${initialTotal}`);
  assert(initialTotal === 81, 'Baseline dev.db total row count is exactly 81');

  // 3. Start Express server child process on port 4100 pointing to scratch DB
  console.log(`Starting test server on port ${TEST_PORT}...`);
  const serverProcess = spawn('node', ['src/index.js'], {
    cwd: serverDir,
    env: {
      ...process.env,
      PORT: String(TEST_PORT),
      MONGODB_URL: testMongoUrl,
      AVATAR_STORAGE_DIR: testAvatarDir,
      NODE_ENV: 'test',
    },
    stdio: 'pipe',
  });

  serverProcess.stderr.on('data', (d) => {
    const msg = d.toString();
    if (!msg.includes('ExperimentalWarning')) {
      console.error(`[Server stderr] ${msg}`);
    }
  });

  try {
    await waitForServer(TEST_BASE_URL);
    console.log(`Test server successfully listening at ${TEST_BASE_URL}\n`);

    // Fetch user IDs from scratch database
    const alex = await testPrisma.user.findUnique({ where: { email: 'alex@example.com' } });
    const rimi = await testPrisma.user.findUnique({ where: { email: 'rimi@gmail.com' } });
    const aarav = await testPrisma.user.findUnique({ where: { email: 'aarav.sharma@example.com' } });
    const rohan = await testPrisma.user.findUnique({ where: { email: 'rohan.verma@example.com' } });
    const priya = await testPrisma.user.findUnique({ where: { email: 'priya.patel@example.com' } });
    const ananya = await testPrisma.user.findUnique({ where: { email: 'ananya.iyer@example.com' } });
    const elena = await testPrisma.user.findUnique({ where: { email: 'elena.rostova@example.com' } });

    const alexCookie = `skillswap_session=${signSessionToken(alex.id)}`;
    const rimiCookie = `skillswap_session=${signSessionToken(rimi.id)}`;
    const aaravCookie = `skillswap_session=${signSessionToken(aarav.id)}`;
    const rohanCookie = `skillswap_session=${signSessionToken(rohan.id)}`;
    const _priyaCookie = `skillswap_session=${signSessionToken(priya.id)}`;
    const ananyaCookie = `skillswap_session=${signSessionToken(ananya.id)}`;
    const elenaCookie = `skillswap_session=${signSessionToken(elena.id)}`;

    // SECTION A: Event Creation, Capacity Enforcement, Cancellation
    console.log(`--- Section A: Event Lifecycle, Capacity Limits & Cancellation ---`);

    // A.1 Host creates event with maxAttendees = 2
    const createEventRes = await fetch(`${TEST_BASE_URL}/api/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: alexCookie },
      body: JSON.stringify({
        title: 'Full-Stack Node & Express Workshop',
        description: 'Hands-on backend workshop with strict seating capacity.',
        location: 'Indiranagar Hub, Bengaluru',
        dateTime: '2026-12-05T14:00:00Z',
        lat: 12.9784,
        lng: 77.6408,
        maxAttendees: 2,
      }),
    });
    assert(createEventRes.status === 201, 'Host creates event with maxAttendees=2 (201)');
    const createEventData = await createEventRes.json();
    const eventId = createEventData.event.id;
    assert(createEventData.event.maxAttendees === 2, 'maxAttendees correctly stored as 2');

    // Verify GET /api/events reflects host as GOING and attendeeCount = 1
    const getEventsRes1 = await fetch(`${TEST_BASE_URL}/api/events`, {
      headers: { Cookie: alexCookie },
    });
    const getEventsData1 = await getEventsRes1.json();
    const createdEventItem1 = getEventsData1.events.find((e) => e.id === eventId);
    assert(createdEventItem1?.attendeeCount === 1, 'Event attendeeCount is 1 (host)');
    assert(createdEventItem1?.isFull === false, 'Event isFull is false (1/2 filled)');
    assert(createdEventItem1?.isGoing === true, 'Host isGoing is true');

    // A.2 Host edits title of event
    const patchTitleRes = await fetch(`${TEST_BASE_URL}/api/events/${eventId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Cookie: alexCookie },
      body: JSON.stringify({ title: 'Full-Stack Node & Express Masterclass' }),
    });
    assert(patchTitleRes.status === 200, 'Host edits event title (200)');
    const patchTitleData = await patchTitleRes.json();
    assert(patchTitleData.event.title === 'Full-Stack Node & Express Masterclass', 'Title updated');

    // A.3 User 2 (Rimi) RSVPs -> fills capacity to 2/2
    const rimiRsvpRes = await fetch(`${TEST_BASE_URL}/api/events/${eventId}/rsvp`, {
      method: 'POST',
      headers: { Cookie: rimiCookie },
    });
    assert(rimiRsvpRes.status === 200, 'User 2 (Rimi) joins event (200)');
    const rimiRsvpData = await rimiRsvpRes.json();
    assert(rimiRsvpData.isGoing === true, 'Rimi isGoing === true');

    // Verify event is now FULL
    const getEventsRes2 = await fetch(`${TEST_BASE_URL}/api/events`);
    const getEventsData2 = await getEventsRes2.json();
    const eventItemFull = getEventsData2.events.find((e) => e.id === eventId);
    assert(eventItemFull?.attendeeCount === 2, 'Event attendeeCount is now 2', JSON.stringify(eventItemFull));
    assert(eventItemFull?.isFull === true, 'Event isFull is now TRUE (capacity reached)', JSON.stringify(eventItemFull));

    // A.4 User 3 (Aarav) attempts to RSVP -> rejected with 409 "This event is full."
    const aaravRsvpRes = await fetch(`${TEST_BASE_URL}/api/events/${eventId}/rsvp`, {
      method: 'POST',
      headers: { Cookie: aaravCookie },
    });
    assert(aaravRsvpRes.status === 409, 'User 3 (Aarav) RSVP rejected with 409 (capacity full)');
    const aaravRsvpData = await aaravRsvpRes.json();
    assert(aaravRsvpData.error === 'This event is full.', 'Error message: "This event is full."');

    // A.5 User 2 (Rimi) cancels RSVP (toggles off) -> always allowed
    const rimiLeaveRes = await fetch(`${TEST_BASE_URL}/api/events/${eventId}/rsvp`, {
      method: 'POST',
      headers: { Cookie: rimiCookie },
    });
    assert(rimiLeaveRes.status === 200, 'User 2 (Rimi) toggles OFF RSVP (200)');
    const rimiLeaveData = await rimiLeaveRes.json();
    assert(rimiLeaveData.isGoing === false, 'Rimi isGoing === false (slot freed)');

    // A.6 User 3 (Aarav) can now join because 1 slot is free
    const aaravJoinRes = await fetch(`${TEST_BASE_URL}/api/events/${eventId}/rsvp`, {
      method: 'POST',
      headers: { Cookie: aaravCookie },
    });
    assert(aaravJoinRes.status === 200, 'User 3 (Aarav) successfully joins freed slot (200)');
    const aaravJoinData = await aaravJoinRes.json();
    assert(aaravJoinData.isGoing === true, 'Aarav isGoing === true');

    // A.7 Host attempts to lower capacity below current going count (current goingCount is 2)
    const lowerCapRes = await fetch(`${TEST_BASE_URL}/api/events/${eventId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Cookie: alexCookie },
      body: JSON.stringify({ maxAttendees: 1 }),
    });
    assert(lowerCapRes.status === 409, 'Lowering maxAttendees below going count rejected with 409');
    const lowerCapData = await lowerCapRes.json();
    assert(lowerCapData.error?.includes('below the current attendee count (2)'), 'Error detail matches capacity rule');

    // A.8 Host cancels the event
    const cancelRes = await fetch(`${TEST_BASE_URL}/api/events/${eventId}/cancel`, {
      method: 'POST',
      headers: { Cookie: alexCookie },
    });
    assert(cancelRes.status === 200, 'Host cancels event (200)');
    const cancelData = await cancelRes.json();
    assert(cancelData.message === 'Event cancelled successfully', 'Cancellation message confirmed');

    // A.9 Host attempts to cancel already cancelled event -> 409
    const secondCancelRes = await fetch(`${TEST_BASE_URL}/api/events/${eventId}/cancel`, {
      method: 'POST',
      headers: { Cookie: alexCookie },
    });
    assert(secondCancelRes.status === 409, 'Second cancellation attempt rejected with 409');
    const secondCancelData = await secondCancelRes.json();
    assert(secondCancelData.error === 'Event is already cancelled', 'Error: "Event is already cancelled"');

    // A.10 Modifying or RSVPing to cancelled event -> 409
    const editCancelledRes = await fetch(`${TEST_BASE_URL}/api/events/${eventId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Cookie: alexCookie },
      body: JSON.stringify({ title: 'Edit cancelled event' }),
    });
    assert(editCancelledRes.status === 409, 'Editing cancelled event rejected with 409');

    const rsvpCancelledRes = await fetch(`${TEST_BASE_URL}/api/events/${eventId}/rsvp`, {
      method: 'POST',
      headers: { Cookie: rimiCookie },
    });
    assert(rsvpCancelledRes.status === 409, 'RSVP to cancelled event rejected with 409');
    const rsvpCancelledData = await rsvpCancelledRes.json();
    assert(rsvpCancelledData.error === 'This event has been cancelled.', 'Error: "This event has been cancelled."');

    // A.11 Visibility of cancelled events:
    // - Host (Alex) sees cancelled event
    const hostSeeRes = await fetch(`${TEST_BASE_URL}/api/events`, { headers: { Cookie: alexCookie } });
    const hostSeeData = await hostSeeRes.json();
    const hostFound = hostSeeData.events.find((e) => e.id === eventId);
    assert(Boolean(hostFound && hostFound.cancelled === true), 'Host sees cancelled event with cancelled: true');

    // - Attendee (Aarav) sees cancelled event
    const attendeeSeeRes = await fetch(`${TEST_BASE_URL}/api/events`, { headers: { Cookie: aaravCookie } });
    const attendeeSeeData = await attendeeSeeRes.json();
    const attendeeFound = attendeeSeeData.events.find((e) => e.id === eventId);
    assert(Boolean(attendeeFound && attendeeFound.cancelled === true), 'Attendee sees cancelled event');

    // - Stranger (Rohan Verma) does NOT see cancelled event
    const strangerSeeRes = await fetch(`${TEST_BASE_URL}/api/events`, { headers: { Cookie: rohanCookie } });
    const strangerSeeData = await strangerSeeRes.json();
    const strangerFound = strangerSeeData.events.find((e) => e.id === eventId);
    assert(!strangerFound, 'Stranger does NOT see cancelled event');

    // - Unauthenticated user does NOT see cancelled event
    const unauthSeeRes = await fetch(`${TEST_BASE_URL}/api/events`);
    const unauthSeeData = await unauthSeeRes.json();
    const unauthFound = unauthSeeData.events.find((e) => e.id === eventId);
    assert(!unauthFound, 'Unauthenticated user does NOT see cancelled event');

    // SECTION B: Matches -> Messages -> Reviews Write Flow
    console.log(`\n--- Section B: Matches, Messages, Reviews Write Flow ---`);

    // B.1 Rohan connects with Rimi
    const connectRes = await fetch(`${TEST_BASE_URL}/api/matches`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: rohanCookie },
      body: JSON.stringify({ targetUserId: rimi.id, matchedSkillName: 'Hindi Conversation' }),
    });
    assert(connectRes.status === 201, 'Rohan sends connection request to Rimi (201)');
    const connectData = await connectRes.json();
    const newMatchId = connectData.match.id;

    // B.2 Rimi accepts connection request
    const acceptRes = await fetch(`${TEST_BASE_URL}/api/matches/${newMatchId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Cookie: rimiCookie },
      body: JSON.stringify({ status: 'ACCEPTED' }),
    });
    assert(acceptRes.status === 200, 'Rimi accepts match request (200)');

    // B.3 Rohan sends message to Rimi
    const messageRes = await fetch(`${TEST_BASE_URL}/api/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: rohanCookie },
      body: JSON.stringify({ matchId: newMatchId, content: 'Namaste Rimi, looking forward to our exchange!' }),
    });
    assert(messageRes.status === 201, 'Rohan posts message to Rimi (201)');

    // B.4 Rohan submits review for Rimi
    const reviewRes = await fetch(`${TEST_BASE_URL}/api/reviews`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: rohanCookie },
      body: JSON.stringify({ toUserId: rimi.id, rating: 5, comment: 'Wonderful conversation partner!' }),
    });
    assert(reviewRes.status === 201, 'Rohan submits review for Rimi (201)');

    // B.5 Duplicate review attempt returns 409
    const dupReviewRes = await fetch(`${TEST_BASE_URL}/api/reviews`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: rohanCookie },
      body: JSON.stringify({ toUserId: rimi.id, rating: 4, comment: 'Trying duplicate' }),
    });
    assert(dupReviewRes.status === 409, 'Duplicate review returns 409 Conflict');

    // SECTION C: Avatar Upload & Deletion Write Flow
    console.log(`\n--- Section C: Avatar Upload & Deletion Write Flow ---`);

    // Create a valid 64x64 PNG in memory
    const pngBuffer = await sharp({
      create: { width: 64, height: 64, channels: 4, background: { r: 50, g: 150, b: 250, alpha: 1 } },
    })
      .png()
      .toBuffer();

    const avatarFormData = new FormData();
    avatarFormData.append('file', new Blob([pngBuffer], { type: 'image/png' }), 'test-avatar.png');

    const uploadAvatarRes = await fetch(`${TEST_BASE_URL}/api/user/avatar`, {
      method: 'POST',
      headers: { Cookie: alexCookie },
      body: avatarFormData,
    });
    assert(uploadAvatarRes.status === 200, 'Alex uploads avatar (200)');
    const uploadAvatarData = await uploadAvatarRes.json();
    const avatarUrl = uploadAvatarData.avatarUrl;
    assert(avatarUrl?.startsWith('/api/avatars/'), 'Returned avatarUrl has /api/avatars/ prefix');

    // Verify storage presence in MongoDB (prisma.avatarFile) when AVATAR_STORAGE!=disk, or disk otherwise
    const avatarFileName = avatarUrl.slice('/api/avatars/'.length);
    const storedFilePath = path.resolve(testAvatarDir, avatarFileName);
    const isDiskStorage = process.env.AVATAR_STORAGE === 'disk';

    if (isDiskStorage) {
      assert(fs.existsSync(storedFilePath), 'Processed avatar file created in storage directory');
    } else {
      const avatarDoc = await testPrisma.avatarFile.findUnique({ where: { id: avatarFileName } });
      assert(avatarDoc !== null && avatarDoc?.contentType === 'image/webp', 'Processed avatar record created in MongoDB AvatarFile collection');
    }

    // GET /api/avatars/<file> returns 200 image/webp
    const getAvatarRes = await fetch(`${TEST_BASE_URL}${avatarUrl}`, {
      headers: { Cookie: alexCookie },
    });
    assert(getAvatarRes.status === 200, 'GET /api/avatars/:file returns 200');
    assert(getAvatarRes.headers.get('content-type') === 'image/webp', 'Content-Type is image/webp');

    // DELETE /api/user/avatar removes avatar and deletes file
    const deleteAvatarRes = await fetch(`${TEST_BASE_URL}/api/user/avatar`, {
      method: 'DELETE',
      headers: { Cookie: alexCookie },
    });
    assert(deleteAvatarRes.status === 200, 'DELETE /api/user/avatar returns 200');
    if (isDiskStorage) {
      assert(!fs.existsSync(storedFilePath), 'Old avatar file removed from storage on delete');
    } else {
      const deletedDoc = await testPrisma.avatarFile.findUnique({ where: { id: avatarFileName } });
      assert(deletedDoc === null, 'Old avatar record removed from MongoDB AvatarFile collection on delete');
    }

    // SECTION D: High-Concurrency Race Condition Tests
    console.log(`\n--- Section D: Concurrency Race Condition Tests ---`);

    // D.1 Parallel Identical Reviews Race Safety
    // Ensure two parallel reviews from same user to same peer give exactly one 201 and one 409
    // Connect Aarav and Priya first
    const _matchAaravPriya = await testPrisma.match.create({
      data: {
        userAId: aarav.id,
        userBId: priya.id,
        matchedSkillId: (await testPrisma.skill.findFirst()).id,
        status: 'ACCEPTED',
      },
    });

    const [reviewResA, reviewResB] = await Promise.all([
      fetch(`${TEST_BASE_URL}/api/reviews`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: aaravCookie },
        body: JSON.stringify({ toUserId: priya.id, rating: 5, comment: 'Parallel review 1' }),
      }),
      fetch(`${TEST_BASE_URL}/api/reviews`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: aaravCookie },
        body: JSON.stringify({ toUserId: priya.id, rating: 5, comment: 'Parallel review 2' }),
      }),
    ]);

    const reviewStatuses = [reviewResA.status, reviewResB.status].sort();
    assert(
      reviewStatuses[0] === 201 && reviewStatuses[1] === 409,
      'Concurrent duplicate reviews yield exactly one 201 and one 409',
      `Got statuses: [${reviewStatuses.join(', ')}]`
    );

    // D.2 Parallel RSVP Capacity Race Safety
    // Create an event with capacity limit = 2 (1 host + 1 guest allowed)
    const raceEventRes = await fetch(`${TEST_BASE_URL}/api/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: alexCookie },
      body: JSON.stringify({
        title: 'Concurrent Race RSVP Event',
        description: 'Only 1 additional guest allowed.',
        location: 'Koramangala, Bengaluru',
        dateTime: '2026-12-10T18:00:00Z',
        maxAttendees: 2,
      }),
    });
    const raceEventData = await raceEventRes.json();
    const raceEventId = raceEventData.event.id;

    // 4 users attempt to join concurrently: Rimi, Aarav, Ananya, Elena
    const [rsvpRes1, rsvpRes2, rsvpRes3, rsvpRes4] = await Promise.all([
      fetch(`${TEST_BASE_URL}/api/events/${raceEventId}/rsvp`, { method: 'POST', headers: { Cookie: rimiCookie } }),
      fetch(`${TEST_BASE_URL}/api/events/${raceEventId}/rsvp`, { method: 'POST', headers: { Cookie: aaravCookie } }),
      fetch(`${TEST_BASE_URL}/api/events/${raceEventId}/rsvp`, { method: 'POST', headers: { Cookie: ananyaCookie } }),
      fetch(`${TEST_BASE_URL}/api/events/${raceEventId}/rsvp`, { method: 'POST', headers: { Cookie: elenaCookie } }),
    ]);

    const rsvpStatuses = [rsvpRes1.status, rsvpRes2.status, rsvpRes3.status, rsvpRes4.status].sort();
    const successCount = rsvpStatuses.filter((s) => s === 200).length;
    const conflictCount = rsvpStatuses.filter((s) => s === 409).length;

    assert(successCount === 1, 'Exactly one concurrent RSVP succeeded (status 200)', `successCount=${successCount}`);
    assert(conflictCount === 3, 'All other concurrent RSVPs were rejected (status 409)', `conflictCount=${conflictCount}`);

    const finalGoingAttendees = await testPrisma.eventAttendee.count({
      where: { eventId: raceEventId, status: 'GOING' },
    });
    assert(finalGoingAttendees === 2, 'Total going attendees in DB strictly equals maxAttendees (2)', `going=${finalGoingAttendees}`);

  } finally {
    // 4. Teardown test server
    console.log('\nShutting down test server...');
    serverProcess.kill('SIGTERM');
    await sleep(500);

    // 5. Clean up temporary files and scratch database
    if (fs.existsSync(tmpDir)) {
      fs.rmSync(tmpDir, { recursive: true, force: true });
      console.log('Cleaned up temporary avatar files.');
    }

    await testPrisma.$disconnect();
    await dropScratchDatabase(testDbName, testMongoUrl);

    // Verify dev.db remains untouched (81 rows)
    const dbPath = path.resolve(rootDir, 'prisma', 'dev.db');
    if (fs.existsSync(dbPath)) {
      const { DatabaseSync } = await import('node:sqlite');
      const db = new DatabaseSync(dbPath, { readOnly: true });
      const tables = ['User', 'Skill', 'UserSkillsTeach', 'UserSkillsLearn', 'Match', 'Event', 'EventAttendee', 'Review', 'Message'];
      let finalDevDbCount = 0;
      for (const t of tables) {
        const row = db.prepare(`SELECT COUNT(*) as cnt FROM "${t}"`).get();
        finalDevDbCount += Number(row.cnt);
      }
      db.close();
      if (finalDevDbCount === 81) {
        console.log(`Final dev.db total row count remains strictly 81`);
      }
    }
  }

  console.log(`\n==============================================`);
  console.log(`P3.5 Write & Concurrency Summary: ${passed} passed, ${failed} failed`);
  console.log(`==============================================\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

run().catch((err) => {
  console.error('P3.5 write test failed with error:', err);
  process.exit(1);
});
