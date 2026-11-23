// server/scripts/migrate-sqlite-to-mongo.mjs
// Data migration from SQLite (prisma/dev.db) to MongoDB using Prisma Client.
// Plain Node ESM. Default is DRY-RUN. Writes only with --apply.

import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';
import config from '../src/config/env.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..', '..');
const sqlitePath = path.resolve(rootDir, 'prisma', 'dev.db');

const args = process.argv.slice(2);
const isApply = args.includes('--apply');
const targetUrlArg = args.find((a) => a.startsWith('--target-url='));
const targetMongoUrl = targetUrlArg ? targetUrlArg.slice('--target-url='.length) : (process.env.MONGODB_URL || config.MONGODB_URL);

function toDate(val) {
  if (val === null || val === undefined) return null;
  if (typeof val === 'number') return new Date(val);
  if (typeof val === 'string') {
    const num = Number(val);
    if (!isNaN(num) && /^\d+$/.test(val)) return new Date(num);
    const d = new Date(val);
    if (!isNaN(d.getTime())) return d;
  }
  if (val instanceof Date) return val;
  return null;
}

async function run() {
  console.log('==============================================');
  console.log(`SQLite to MongoDB Data Migration (${isApply ? 'APPLY' : 'DRY RUN'})`);
  console.log(`Source SQLite: ${sqlitePath}`);
  console.log('Target MongoDB: [Configured URI Redacted]');
  console.log('==============================================\n');

  if (!fs.existsSync(sqlitePath)) {
    throw new Error(`Source SQLite file not found at: ${sqlitePath}`);
  }

  // 1. Read SQLite source database read-only
  const sqlite = new DatabaseSync(sqlitePath, { readOnly: true });

  const rawUsers = sqlite.prepare('SELECT * FROM User').all();
  const rawSkills = sqlite.prepare('SELECT * FROM Skill').all();
  const rawTeach = sqlite.prepare('SELECT * FROM UserSkillsTeach').all();
  const rawLearn = sqlite.prepare('SELECT * FROM UserSkillsLearn').all();
  const rawMatches = sqlite.prepare('SELECT * FROM Match').all();
  const rawEvents = sqlite.prepare('SELECT * FROM Event').all();
  const rawAttendees = sqlite.prepare('SELECT * FROM EventAttendee').all();
  const rawReviews = sqlite.prepare('SELECT * FROM Review').all();
  const rawMessages = sqlite.prepare('SELECT * FROM Message').all();

  sqlite.close();

  const sourceCounts = {
    User: rawUsers.length,
    Skill: rawSkills.length,
    UserSkillsTeach: rawTeach.length,
    UserSkillsLearn: rawLearn.length,
    Match: rawMatches.length,
    Event: rawEvents.length,
    EventAttendee: rawAttendees.length,
    Review: rawReviews.length,
    Message: rawMessages.length,
  };

  const totalSource = Object.values(sourceCounts).reduce((a, b) => a + b, 0);

  console.log('--- Source Table Counts ---');
  for (const [table, count] of Object.entries(sourceCounts)) {
    console.log(`  ${table.padEnd(18)}: ${count}`);
  }
  console.log(`  ${'TOTAL ROWS'.padEnd(18)}: ${totalSource}\n`);

  if (totalSource !== 81) {
    throw new Error(`Expected exactly 81 source rows, found ${totalSource}`);
  }

  // 2. Validate Source Data
  console.log('--- Data Validation ---');

  const userIds = new Set(rawUsers.map((u) => u.id));
  const skillIds = new Set(rawSkills.map((s) => s.id));
  const matchIds = new Set(rawMatches.map((m) => m.id));
  const eventIds = new Set(rawEvents.map((e) => e.id));

  // Check unique email
  const userEmails = new Set();
  for (const u of rawUsers) {
    if (userEmails.has(u.email)) {
      throw new Error(`Duplicate User email in source: ${u.email}`);
    }
    userEmails.add(u.email);
  }

  // Check new Match unique constraint [userAId, userBId, matchedSkillId]
  const matchTriples = new Set();
  for (const m of rawMatches) {
    const key = `${m.userAId}:${m.userBId}:${m.matchedSkillId}`;
    if (matchTriples.has(key)) {
      throw new Error(`Duplicate Match triple in source: ${key}`);
    }
    matchTriples.add(key);
  }

  // Check new Review unique constraint [fromUserId, toUserId]
  const reviewPairs = new Set();
  for (const r of rawReviews) {
    const key = `${r.fromUserId}:${r.toUserId}`;
    if (reviewPairs.has(key)) {
      throw new Error(`Duplicate Review pair in source: ${key}`);
    }
    reviewPairs.add(key);
  }

  // Validate Foreign Keys
  let danglingFk = 0;
  for (const r of rawTeach) {
    if (!userIds.has(r.userId) || !skillIds.has(r.skillId)) danglingFk++;
  }
  for (const r of rawLearn) {
    if (!userIds.has(r.userId) || !skillIds.has(r.skillId)) danglingFk++;
  }
  for (const m of rawMatches) {
    if (!userIds.has(m.userAId) || !userIds.has(m.userBId) || !skillIds.has(m.matchedSkillId)) danglingFk++;
  }
  for (const e of rawEvents) {
    if (!userIds.has(e.hostId)) danglingFk++;
  }
  for (const a of rawAttendees) {
    if (!eventIds.has(a.eventId) || !userIds.has(a.userId)) danglingFk++;
  }
  for (const r of rawReviews) {
    if (!userIds.has(r.fromUserId) || !userIds.has(r.toUserId)) danglingFk++;
  }
  for (const msg of rawMessages) {
    if (!matchIds.has(msg.matchId) || !userIds.has(msg.senderId)) danglingFk++;
  }

  if (danglingFk > 0) {
    throw new Error(`Validation failed: ${danglingFk} dangling foreign keys detected in source.`);
  }

  // Validate Dates
  for (const u of rawUsers) {
    if (!toDate(u.createdAt) || !toDate(u.updatedAt)) throw new Error(`Invalid date on User ${u.id}`);
  }
  for (const e of rawEvents) {
    if (!toDate(e.createdAt) || !toDate(e.dateTime)) throw new Error(`Invalid date on Event ${e.id}`);
  }

  console.log('  ✓ No duplicate User emails');
  console.log('  ✓ No duplicate Match triples (userAId + userBId + matchedSkillId)');
  console.log('  ✓ No duplicate Review pairs (fromUserId + toUserId)');
  console.log('  ✓ Zero dangling foreign key references');
  console.log('  ✓ All Date and DateTime values parse correctly');
  console.log('  ✓ Validation PASSED\n');

  if (!isApply) {
    console.log('--------------------------------------------------');
    console.log('DRY RUN COMPLETE: All 81 records are valid for import.');
    console.log('To execute the migration against the target database, run:');
    console.log('  node server/scripts/migrate-sqlite-to-mongo.mjs --apply');
    console.log('--------------------------------------------------\n');
    return;
  }

  // 3. APPLY: Connect to Target MongoDB via Prisma
  console.log('Connecting to target MongoDB...');
  const prisma = new PrismaClient({
    datasources: { db: { url: targetMongoUrl } },
    log: ['error'],
  });

  try {
    // Check that target database has 0 documents across all collections
    const existingCount =
      (await prisma.user.count()) +
      (await prisma.skill.count()) +
      (await prisma.userSkillsTeach.count()) +
      (await prisma.userSkillsLearn.count()) +
      (await prisma.match.count()) +
      (await prisma.event.count()) +
      (await prisma.eventAttendee.count()) +
      (await prisma.review.count()) +
      (await prisma.message.count());

    if (existingCount > 0) {
      throw new Error(`Target database is NOT empty (${existingCount} documents exist). Migration halted to prevent data corruption.`);
    }

    console.log('Target database verified empty. Importing records in topological order...');

    // 1. Users
    const usersToInsert = rawUsers.map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      passwordHash: u.passwordHash,
      bio: u.bio,
      location: u.location,
      latitude: u.latitude !== null ? Number(u.latitude) : null,
      longitude: u.longitude !== null ? Number(u.longitude) : null,
      avatarUrl: u.avatarUrl,
      createdAt: toDate(u.createdAt),
      updatedAt: toDate(u.updatedAt),
    }));
    await prisma.user.createMany({ data: usersToInsert });
    console.log(`  ✓ Inserted ${usersToInsert.length} Users`);

    // 2. Skills
    const skillsToInsert = rawSkills.map((s) => ({
      id: s.id,
      name: s.name,
      category: s.category,
    }));
    await prisma.skill.createMany({ data: skillsToInsert });
    console.log(`  ✓ Inserted ${skillsToInsert.length} Skills`);

    // 3. UserSkillsTeach
    const teachToInsert = rawTeach.map((t) => ({
      id: t.id,
      userId: t.userId,
      skillId: t.skillId,
      proficiency: t.proficiency,
    }));
    await prisma.userSkillsTeach.createMany({ data: teachToInsert });
    console.log(`  ✓ Inserted ${teachToInsert.length} UserSkillsTeach records`);

    // 4. UserSkillsLearn
    const learnToInsert = rawLearn.map((l) => ({
      id: l.id,
      userId: l.userId,
      skillId: l.skillId,
    }));
    await prisma.userSkillsLearn.createMany({ data: learnToInsert });
    console.log(`  ✓ Inserted ${learnToInsert.length} UserSkillsLearn records`);

    // 5. Matches
    const matchesToInsert = rawMatches.map((m) => ({
      id: m.id,
      userAId: m.userAId,
      userBId: m.userBId,
      matchedSkillId: m.matchedSkillId,
      status: m.status,
      createdAt: toDate(m.createdAt),
    }));
    await prisma.match.createMany({ data: matchesToInsert });
    console.log(`  ✓ Inserted ${matchesToInsert.length} Matches`);

    // 6. Events
    const eventsToInsert = rawEvents.map((e) => ({
      id: e.id,
      hostId: e.hostId,
      title: e.title,
      description: e.description,
      location: e.location,
      lat: e.lat !== null ? Number(e.lat) : null,
      lng: e.lng !== null ? Number(e.lng) : null,
      dateTime: toDate(e.dateTime),
      maxAttendees: e.maxAttendees !== null ? Number(e.maxAttendees) : null,
      cancelledAt: toDate(e.cancelledAt),
      createdAt: toDate(e.createdAt),
    }));
    await prisma.event.createMany({ data: eventsToInsert });
    console.log(`  ✓ Inserted ${eventsToInsert.length} Events`);

    // 7. EventAttendees
    const attendeesToInsert = rawAttendees.map((a) => ({
      id: a.id,
      eventId: a.eventId,
      userId: a.userId,
      status: a.status,
    }));
    await prisma.eventAttendee.createMany({ data: attendeesToInsert });
    console.log(`  ✓ Inserted ${attendeesToInsert.length} EventAttendees`);

    // 8. Reviews
    const reviewsToInsert = rawReviews.map((r) => ({
      id: r.id,
      fromUserId: r.fromUserId,
      toUserId: r.toUserId,
      rating: Number(r.rating),
      comment: r.comment,
      createdAt: toDate(r.createdAt),
    }));
    await prisma.review.createMany({ data: reviewsToInsert });
    console.log(`  ✓ Inserted ${reviewsToInsert.length} Reviews`);

    // 9. Messages
    const messagesToInsert = rawMessages.map((msg) => ({
      id: msg.id,
      matchId: msg.matchId,
      senderId: msg.senderId,
      content: msg.content,
      createdAt: toDate(msg.createdAt),
    }));
    await prisma.message.createMany({ data: messagesToInsert });
    console.log(`  ✓ Inserted ${messagesToInsert.length} Messages\n`);

    // 4. Post-Import Verification
    console.log('--- Post-Import Target Verification ---');
    const targetCounts = {
      User: await prisma.user.count(),
      Skill: await prisma.skill.count(),
      UserSkillsTeach: await prisma.userSkillsTeach.count(),
      UserSkillsLearn: await prisma.userSkillsLearn.count(),
      Match: await prisma.match.count(),
      Event: await prisma.event.count(),
      EventAttendee: await prisma.eventAttendee.count(),
      Review: await prisma.review.count(),
      Message: await prisma.message.count(),
    };

    let countsMatch = true;
    for (const [table, count] of Object.entries(targetCounts)) {
      const match = count === sourceCounts[table];
      if (!match) countsMatch = false;
      console.log(`  ${table.padEnd(18)}: ${count} (expected ${sourceCounts[table]}) [${match ? 'OK' : 'MISMATCH'}]`);
    }

    const totalTarget = Object.values(targetCounts).reduce((a, b) => a + b, 0);
    console.log(`  ${'TOTAL TARGET'.padEnd(18)}: ${totalTarget} (expected 81)\n`);

    if (!countsMatch || totalTarget !== 81) {
      throw new Error(`Target verification failed: counts do not match expected 81 records.`);
    }

    // Verify bcrypt password verification for alex@example.com
    const alex = await prisma.user.findUnique({ where: { email: 'alex@example.com' } });
    if (!alex || !alex.passwordHash) {
      throw new Error('Alex user not found in target database.');
    }
    const isPasswordValid = await bcrypt.compare('password123', alex.passwordHash);
    if (!isPasswordValid) {
      throw new Error('Password hash verification failed for alex@example.com');
    }
    console.log('  ✓ Alex Kumar credential verification (password123): VALID');

    console.log('\n==============================================');
    console.log('SUCCESS: All 81 SQLite records migrated to MongoDB!');
    console.log('==============================================\n');
  } finally {
    await prisma.$disconnect();
  }
}

run().catch((err) => {
  console.error('\n[MIGRATION ERROR]', err.message);
  process.exit(1);
});
