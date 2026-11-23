// server/scripts/import-backup.mjs
// Imports SkillSwap collections from an export-backup folder into MongoDB in topological order.
// Plain Node ESM. Default is DRY RUN (read-only validation & preview).
// To apply changes, pass --apply.
//
// SAFETY GUARDS:
// 1. Refuses to run full import if destination database contains ANY documents.
// 2. Refuses --skills-only if Skill collection already contains ANY documents.
// 3. Validates unique constraints, enums, and foreign-key integrity before writing.
// 4. NEVER logs connection strings, JWT secrets, passwords, or password hashes.
//
// SECURITY ADVISORY:
// Imported users from dev backups retain their development passwords (e.g. 'password123').
// In production, either start with an empty user database (seed only skills via --skills-only)
// or immediately prompt users to reset/change their passwords.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { prisma } from '../src/db/prisma.js';
import config from '../src/config/env.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..', '..');

// Allowed enum values
const VALID_MATCH_STATUSES = new Set(['PENDING', 'ACCEPTED', 'DECLINED', 'BLOCKED']);
const VALID_ATTENDEE_STATUSES = new Set(['GOING', 'INTERESTED', 'NOT_GOING']);
const VALID_PROFICIENCIES = new Set(['Beginner', 'Intermediate', 'Advanced', 'Expert']);
const VALID_SKILL_CATEGORIES = new Set([
  'Programming',
  'Design',
  'Languages',
  'Music',
  'Culinary',
  'Arts',
  'Personal Growth',
  'Games',
  'Health',
  'General',
]);

// Parse command line flags
const args = process.argv.slice(2);
const isApply = args.includes('--apply');
const isSkillsOnly = args.includes('--skills-only');
const fromArg = args.find((a) => a.startsWith('--from='));
const customFromDir = fromArg ? fromArg.slice('--from='.length) : null;

function resolveBackupDir() {
  if (customFromDir) {
    const resolved = path.resolve(customFromDir);
    if (!fs.existsSync(resolved)) {
      throw new Error(`Specified backup folder does not exist: ${resolved}`);
    }
    return resolved;
  }

  const backupsBase = path.resolve(rootDir, '..', 'skillswap-backups');
  if (!fs.existsSync(backupsBase)) {
    throw new Error(`Backups directory not found at: ${backupsBase}`);
  }

  const entries = fs
    .readdirSync(backupsBase, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .sort()
    .reverse();

  if (entries.length === 0) {
    throw new Error(`No backup folders found in: ${backupsBase}`);
  }

  return path.resolve(backupsBase, entries[0]);
}

async function getDestinationCounts() {
  const [
    userCount,
    skillCount,
    teachCount,
    learnCount,
    matchCount,
    eventCount,
    attendeeCount,
    reviewCount,
    messageCount,
    avatarCount,
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
    prisma.avatarFile.count(),
  ]);

  const total =
    userCount +
    skillCount +
    teachCount +
    learnCount +
    matchCount +
    eventCount +
    attendeeCount +
    reviewCount +
    messageCount +
    avatarCount;

  return {
    userCount,
    skillCount,
    teachCount,
    learnCount,
    matchCount,
    eventCount,
    attendeeCount,
    reviewCount,
    messageCount,
    avatarCount,
    total,
  };
}

async function main() {
  const backupDir = resolveBackupDir();

  console.log('==============================================');
  console.log('SkillSwap Database Backup Restore / Seed Tool');
  console.log(`Mode:            ${isApply ? 'APPLY (Writing to Database)' : 'DRY RUN (Validation Preview)'}`);
  console.log(`Scope:           ${isSkillsOnly ? 'SKILLS ONLY' : 'FULL RESTORE'}`);
  console.log(`Source Folder:   ${backupDir}`);
  console.log(`Target Database: ${config.DB_NAME}`);
  console.log('==============================================\n');

  // Check destination database document counts
  const initialCounts = await getDestinationCounts();

  if (isSkillsOnly) {
    if (initialCounts.skillCount > 0) {
      throw new Error(
        `SAFETY GUARD REFUSAL: Skill collection in database '${config.DB_NAME}' already contains ${initialCounts.skillCount} documents. Import requires an empty collection.`
      );
    }
  } else {
    if (initialCounts.total > 0) {
      throw new Error(
        `SAFETY GUARD REFUSAL: Destination database '${config.DB_NAME}' is not empty (${initialCounts.total} documents present). Restore is strictly for empty databases to prevent data collisions.`
      );
    }
  }

  console.log('Destination database confirmed empty for required scope. Proceeding with file validation...\n');

  // Read files
  function readJsonFile(name) {
    const filePath = path.join(backupDir, `${name}.json`);
    if (!fs.existsSync(filePath)) {
      return null;
    }
    const raw = fs.readFileSync(filePath, 'utf8');
    try {
      return JSON.parse(raw);
    } catch (err) {
      throw new Error(`Corrupt JSON in ${name}.json: ${err.message}`);
    }
  }

  const rawSkills = readJsonFile('Skill') || [];
  const rawUsers = readJsonFile('User') || [];
  const rawTeach = readJsonFile('UserSkillsTeach') || [];
  const rawLearn = readJsonFile('UserSkillsLearn') || [];
  const rawMatches = readJsonFile('Match') || [];
  const rawEvents = readJsonFile('Event') || [];
  const rawAttendees = readJsonFile('EventAttendee') || [];
  const rawReviews = readJsonFile('Review') || [];
  const rawMessages = readJsonFile('Message') || [];
  const rawAvatars = readJsonFile('AvatarFile') || [];

  const errors = [];

  // 1. Validate Skills
  const skillIds = new Set();
  const skillNames = new Set();
  for (const s of rawSkills) {
    if (!s.id) errors.push(`Skill missing id: ${JSON.stringify(s)}`);
    if (!s.name) errors.push(`Skill missing name: id=${s.id}`);
    if (skillIds.has(s.id)) errors.push(`Duplicate Skill id: ${s.id}`);
    if (skillNames.has(s.name)) errors.push(`Duplicate Skill name: "${s.name}"`);
    if (!VALID_SKILL_CATEGORIES.has(s.category)) {
      errors.push(`Skill "${s.name}" has invalid category "${s.category}"`);
    }
    skillIds.add(s.id);
    skillNames.add(s.name);
  }

  if (isSkillsOnly) {
    if (errors.length > 0) {
      console.error('Validation errors found:');
      errors.forEach((e) => console.error(`  - ${e}`));
      throw new Error(`Validation failed with ${errors.length} errors.`);
    }

    console.log(`Validation PASSED: ${rawSkills.length} skills valid and ready.`);
    if (!isApply) {
      console.log('\n[DRY RUN COMPLETE] No writes performed. Re-run with --apply to seed skills.');
      return;
    }

    console.log('\nSeeding skills into database...');
    for (const skill of rawSkills) {
      await prisma.skill.create({
        data: {
          id: skill.id,
          name: skill.name,
          category: skill.category,
        },
      });
    }
    const finalSkillsCount = await prisma.skill.count();
    console.log(`\n✓ Successfully imported ${finalSkillsCount} skills into '${config.DB_NAME}'.\n`);
    return;
  }

  // 2. Validate Users
  const userIds = new Set();
  const userEmails = new Set();
  for (const u of rawUsers) {
    if (!u.id) errors.push(`User missing id`);
    if (!u.email) errors.push(`User ${u.id} missing email`);
    if (userIds.has(u.id)) errors.push(`Duplicate User id: ${u.id}`);
    if (userEmails.has(u.email)) errors.push(`Duplicate User email: ${u.email}`);
    userIds.add(u.id);
    userEmails.add(u.email);
  }

  // 3. Validate UserSkillsTeach
  const teachKeys = new Set();
  for (const t of rawTeach) {
    if (!t.id) errors.push(`UserSkillsTeach missing id`);
    if (!userIds.has(t.userId)) errors.push(`UserSkillsTeach ${t.id} references missing userId: ${t.userId}`);
    if (!skillIds.has(t.skillId)) errors.push(`UserSkillsTeach ${t.id} references missing skillId: ${t.skillId}`);
    if (!VALID_PROFICIENCIES.has(t.proficiency)) {
      errors.push(`UserSkillsTeach ${t.id} has invalid proficiency: ${t.proficiency}`);
    }
    const pair = `${t.userId}:${t.skillId}`;
    if (teachKeys.has(pair)) errors.push(`Duplicate UserSkillsTeach pair: ${pair}`);
    teachKeys.add(pair);
  }

  // 4. Validate UserSkillsLearn
  const learnKeys = new Set();
  for (const l of rawLearn) {
    if (!l.id) errors.push(`UserSkillsLearn missing id`);
    if (!userIds.has(l.userId)) errors.push(`UserSkillsLearn ${l.id} references missing userId: ${l.userId}`);
    if (!skillIds.has(l.skillId)) errors.push(`UserSkillsLearn ${l.id} references missing skillId: ${l.skillId}`);
    const pair = `${l.userId}:${l.skillId}`;
    if (learnKeys.has(pair)) errors.push(`Duplicate UserSkillsLearn pair: ${pair}`);
    learnKeys.add(pair);
  }

  // 5. Validate Matches
  const matchIds = new Set();
  const matchPairs = new Set();
  for (const m of rawMatches) {
    if (!m.id) errors.push(`Match missing id`);
    if (!userIds.has(m.userAId)) errors.push(`Match ${m.id} references missing userAId: ${m.userAId}`);
    if (!userIds.has(m.userBId)) errors.push(`Match ${m.id} references missing userBId: ${m.userBId}`);
    if (!skillIds.has(m.matchedSkillId)) errors.push(`Match ${m.id} references missing matchedSkillId: ${m.matchedSkillId}`);
    if (!VALID_MATCH_STATUSES.has(m.status)) {
      errors.push(`Match ${m.id} has invalid status: ${m.status}`);
    }
    const pair = `${m.userAId}:${m.userBId}`;
    if (matchPairs.has(pair)) errors.push(`Duplicate Match pair: ${pair}`);
    matchPairs.add(pair);
    matchIds.add(m.id);
  }

  // 6. Validate Events
  const eventIds = new Set();
  for (const ev of rawEvents) {
    if (!ev.id) errors.push(`Event missing id`);
    if (!userIds.has(ev.hostId)) errors.push(`Event ${ev.id} references missing hostId: ${ev.hostId}`);
    eventIds.add(ev.id);
  }

  // 7. Validate EventAttendee
  const attendeePairs = new Set();
  for (const ea of rawAttendees) {
    if (!ea.id) errors.push(`EventAttendee missing id`);
    if (!eventIds.has(ea.eventId)) errors.push(`EventAttendee ${ea.id} references missing eventId: ${ea.eventId}`);
    if (!userIds.has(ea.userId)) errors.push(`EventAttendee ${ea.id} references missing userId: ${ea.userId}`);
    if (!VALID_ATTENDEE_STATUSES.has(ea.status)) {
      errors.push(`EventAttendee ${ea.id} has invalid status: ${ea.status}`);
    }
    const pair = `${ea.eventId}:${ea.userId}`;
    if (attendeePairs.has(pair)) errors.push(`Duplicate EventAttendee pair: ${pair}`);
    attendeePairs.add(pair);
  }

  // 8. Validate Reviews
  const reviewPairs = new Set();
  for (const r of rawReviews) {
    if (!r.id) errors.push(`Review missing id`);
    if (!userIds.has(r.fromUserId)) errors.push(`Review ${r.id} references missing fromUserId: ${r.fromUserId}`);
    if (!userIds.has(r.toUserId)) errors.push(`Review ${r.id} references missing toUserId: ${r.toUserId}`);
    if (typeof r.rating !== 'number' || r.rating < 1 || r.rating > 5) {
      errors.push(`Review ${r.id} has invalid rating: ${r.rating}`);
    }
    const pair = `${r.fromUserId}:${r.toUserId}`;
    if (reviewPairs.has(pair)) errors.push(`Duplicate Review pair: ${pair}`);
    reviewPairs.add(pair);
  }

  // 9. Validate Messages
  for (const msg of rawMessages) {
    if (!msg.id) errors.push(`Message missing id`);
    if (!matchIds.has(msg.matchId)) errors.push(`Message ${msg.id} references missing matchId: ${msg.matchId}`);
    if (!userIds.has(msg.senderId)) errors.push(`Message ${msg.id} references missing senderId: ${msg.senderId}`);
  }

  // 10. Validate AvatarFiles (if any)
  for (const av of rawAvatars) {
    if (!av.id) errors.push(`AvatarFile missing id`);
    if (av.userId && !userIds.has(av.userId)) {
      errors.push(`AvatarFile ${av.id} references missing userId: ${av.userId}`);
    }
  }

  if (errors.length > 0) {
    console.error('Validation errors found:');
    errors.slice(0, 20).forEach((e) => console.error(`  - ${e}`));
    if (errors.length > 20) console.error(`  ... and ${errors.length - 20} more errors.`);
    throw new Error(`Integrity check failed with ${errors.length} validation errors.`);
  }

  console.log('✓ Integrity & Foreign Key Validation PASSED with 0 errors.');
  console.log('\nBackup Collection Manifest:');
  console.log(`  - Skill:           ${rawSkills.length} docs`);
  console.log(`  - User:            ${rawUsers.length} docs`);
  console.log(`  - UserSkillsTeach: ${rawTeach.length} docs`);
  console.log(`  - UserSkillsLearn: ${rawLearn.length} docs`);
  console.log(`  - Match:           ${rawMatches.length} docs`);
  console.log(`  - Event:           ${rawEvents.length} docs`);
  console.log(`  - EventAttendee:   ${rawAttendees.length} docs`);
  console.log(`  - Review:          ${rawReviews.length} docs`);
  console.log(`  - Message:         ${rawMessages.length} docs`);
  console.log(`  - AvatarFile:      ${rawAvatars.length} docs`);
  const totalDocs =
    rawSkills.length +
    rawUsers.length +
    rawTeach.length +
    rawLearn.length +
    rawMatches.length +
    rawEvents.length +
    rawAttendees.length +
    rawReviews.length +
    rawMessages.length +
    rawAvatars.length;
  console.log(`Total Documents:     ${totalDocs}`);

  if (!isApply) {
    console.log('\n----------------------------------------------');
    console.log('[DRY RUN COMPLETE] No writes performed.');
    console.log('To execute the restore, re-run with:');
    console.log('  node server/scripts/import-backup.mjs --apply');
    console.log('----------------------------------------------\n');
    return;
  }

  // Execute import in strict topological dependency order
  console.log('\nApplying import in topological order...');

  console.log(`1/10 Importing Skills (${rawSkills.length})...`);
  for (const doc of rawSkills) {
    await prisma.skill.create({
      data: {
        id: doc.id,
        name: doc.name,
        category: doc.category,
      },
    });
  }

  console.log(`2/10 Importing Users (${rawUsers.length})...`);
  for (const doc of rawUsers) {
    await prisma.user.create({
      data: {
        id: doc.id,
        name: doc.name,
        email: doc.email,
        passwordHash: doc.passwordHash,
        bio: doc.bio,
        location: doc.location,
        latitude: doc.latitude,
        longitude: doc.longitude,
        avatarUrl: doc.avatarUrl,
        createdAt: doc.createdAt ? new Date(doc.createdAt) : undefined,
        updatedAt: doc.updatedAt ? new Date(doc.updatedAt) : undefined,
      },
    });
  }

  console.log(`3/10 Importing UserSkillsTeach (${rawTeach.length})...`);
  for (const doc of rawTeach) {
    await prisma.userSkillsTeach.create({
      data: {
        id: doc.id,
        userId: doc.userId,
        skillId: doc.skillId,
        proficiency: doc.proficiency,
      },
    });
  }

  console.log(`4/10 Importing UserSkillsLearn (${rawLearn.length})...`);
  for (const doc of rawLearn) {
    await prisma.userSkillsLearn.create({
      data: {
        id: doc.id,
        userId: doc.userId,
        skillId: doc.skillId,
      },
    });
  }

  console.log(`5/10 Importing Matches (${rawMatches.length})...`);
  for (const doc of rawMatches) {
    await prisma.match.create({
      data: {
        id: doc.id,
        userAId: doc.userAId,
        userBId: doc.userBId,
        matchedSkillId: doc.matchedSkillId,
        status: doc.status,
        createdAt: doc.createdAt ? new Date(doc.createdAt) : undefined,
      },
    });
  }

  console.log(`6/10 Importing Events (${rawEvents.length})...`);
  for (const doc of rawEvents) {
    await prisma.event.create({
      data: {
        id: doc.id,
        hostId: doc.hostId,
        title: doc.title,
        description: doc.description,
        location: doc.location,
        lat: doc.lat,
        lng: doc.lng,
        dateTime: doc.dateTime ? new Date(doc.dateTime) : undefined,
        maxAttendees: doc.maxAttendees,
        cancelledAt: doc.cancelledAt ? new Date(doc.cancelledAt) : null,
        createdAt: doc.createdAt ? new Date(doc.createdAt) : undefined,
      },
    });
  }

  console.log(`7/10 Importing EventAttendees (${rawAttendees.length})...`);
  for (const doc of rawAttendees) {
    await prisma.eventAttendee.create({
      data: {
        id: doc.id,
        eventId: doc.eventId,
        userId: doc.userId,
        status: doc.status,
      },
    });
  }

  console.log(`8/10 Importing Reviews (${rawReviews.length})...`);
  for (const doc of rawReviews) {
    await prisma.review.create({
      data: {
        id: doc.id,
        fromUserId: doc.fromUserId,
        toUserId: doc.toUserId,
        rating: doc.rating,
        comment: doc.comment,
        createdAt: doc.createdAt ? new Date(doc.createdAt) : undefined,
      },
    });
  }

  console.log(`9/10 Importing Messages (${rawMessages.length})...`);
  for (const doc of rawMessages) {
    await prisma.message.create({
      data: {
        id: doc.id,
        matchId: doc.matchId,
        senderId: doc.senderId,
        content: doc.content,
        createdAt: doc.createdAt ? new Date(doc.createdAt) : undefined,
      },
    });
  }

  if (rawAvatars.length > 0) {
    console.log(`10/10 Importing AvatarFiles (${rawAvatars.length})...`);
    for (const doc of rawAvatars) {
      await prisma.avatarFile.create({
        data: {
          id: doc.id,
          userId: doc.userId,
          contentType: doc.contentType,
          size: doc.size,
          data: Buffer.from(doc.data),
          createdAt: doc.createdAt ? new Date(doc.createdAt) : undefined,
        },
      });
    }
  }

  const finalCounts = await getDestinationCounts();

  console.log('\n==============================================');
  console.log('Restore Completed Successfully');
  console.log(`Destination Database: ${config.DB_NAME}`);
  console.log(`Total Documents In DB: ${finalCounts.total}`);
  console.log('==============================================\n');
}

main()
  .catch((err) => {
    console.error('Import failed:', err.message);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
