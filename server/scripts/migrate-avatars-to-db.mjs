// server/scripts/migrate-avatars-to-db.mjs
// Migrates WebP avatars from local disk into MongoDB AvatarFile collection.
// Plain Node ESM. Default is DRY RUN. Run with --apply to perform actual database inserts.
// NEVER deletes disk files. NEVER prints connection strings or secrets.

import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { prisma } from '../src/db/prisma.js';
import config from '../src/config/env.js';
import { isValidAvatarFileName } from '../src/lib/avatar.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..', '..');

const AVATAR_FILENAME_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}-[0-9a-f]{16}\.webp$/i;

// Parse CLI flags
const args = process.argv.slice(2);
const isApply = args.includes('--apply');
const dirArg = args.find((a) => a.startsWith('--dir='));
const customDir = dirArg ? dirArg.slice('--dir='.length) : null;

const targetDir = customDir
  ? path.resolve(customDir)
  : config.AVATAR_STORAGE_DIR || path.resolve(rootDir, 'public', 'uploads', 'avatars');

async function main() {
  console.log('==============================================');
  console.log('SkillSwap Avatar Migration to MongoDB');
  console.log(`Mode:            ${isApply ? 'APPLY (Writing to Database)' : 'DRY RUN (Read-Only Preview)'}`);
  console.log(`Target Database: ${config.DB_NAME}`);
  console.log(`Avatar Dir:      ${targetDir}`);
  console.log('==============================================\n');

  if (!existsSync(targetDir)) {
    console.log(`Avatar directory does not exist: ${targetDir}`);
    console.log('No avatars to migrate. Exiting.');
    return;
  }

  const entries = await fs.readdir(targetDir, { withFileTypes: true });
  const files = entries.filter((e) => e.isFile() && e.name.toLowerCase().endsWith('.webp')).map((e) => e.name);

  console.log(`Found ${files.length} .webp files in storage directory.\n`);

  let scannedCount = 0;
  let validCount = 0;
  let skippedInvalid = 0;
  let skippedMissingUser = 0;
  let alreadyInDbCount = 0;
  let migratedCount = 0;

  for (const fileName of files) {
    scannedCount++;
    console.log(`[${scannedCount}/${files.length}] Checking: ${fileName}`);

    // 1. Validate filename pattern
    if (!AVATAR_FILENAME_REGEX.test(fileName) || !isValidAvatarFileName(fileName)) {
      console.warn(`  ⚠ SKIPPED: Invalid filename format: ${fileName}`);
      skippedInvalid++;
      continue;
    }

    const userId = fileName.slice(0, 36);

    // 2. Verify user exists in database
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true },
    });

    if (!user) {
      console.warn(`  ⚠ SKIPPED: Referenced user ${userId} does not exist in database.`);
      skippedMissingUser++;
      continue;
    }

    // 3. Read file and compute hash/size
    const filePath = path.join(targetDir, fileName);
    const fileBuffer = await fs.readFile(filePath);
    const size = fileBuffer.length;
    const sha256 = crypto.createHash('sha256').update(fileBuffer).digest('hex');

    console.log(`  File size: ${size} bytes | SHA256: ${sha256.slice(0, 16)}... | User: ${user.email}`);

    // 4. Check if record already exists in AvatarFile
    const existing = await prisma.avatarFile.findUnique({
      where: { id: fileName },
      select: { id: true, size: true },
    });

    if (existing) {
      console.log(`  ℹ ALREADY IN DB: AvatarFile record ${fileName} already exists. Refusing to overwrite.`);
      alreadyInDbCount++;
      continue;
    }

    validCount++;

    if (!isApply) {
      console.log(`  [DRY RUN] Would insert AvatarFile id=${fileName} (size=${size} bytes, user=${userId})`);
      continue;
    }

    // 5. Apply write
    console.log(`  Writing AvatarFile to MongoDB...`);
    await prisma.avatarFile.create({
      data: {
        id: fileName,
        userId,
        contentType: 'image/webp',
        size,
        data: fileBuffer,
      },
    });

    // 6. Verify read-back and hash
    const readBack = await prisma.avatarFile.findUnique({
      where: { id: fileName },
    });

    if (!readBack) {
      throw new Error(`FATAL: Verification failed! Could not read back inserted record ${fileName}`);
    }

    const readBackBuffer = Buffer.from(readBack.data);
    const readBackHash = crypto.createHash('sha256').update(readBackBuffer).digest('hex');

    if (readBack.size !== size || readBackHash !== sha256) {
      throw new Error(
        `FATAL: Verification mismatch for ${fileName}! Expected size=${size}, got=${readBack.size}. Expected hash=${sha256}, got=${readBackHash}`
      );
    }

    console.log(`  ✓ Inserted & verified identical SHA256 in MongoDB.`);
    migratedCount++;
  }

  console.log('\n----------------------------------------------');
  console.log('Avatar Migration Summary');
  console.log(`Total WebP files scanned:  ${scannedCount}`);
  console.log(`Already in MongoDB:        ${alreadyInDbCount}`);
  console.log(`Skipped (invalid name):    ${skippedInvalid}`);
  console.log(`Skipped (unknown user):    ${skippedMissingUser}`);
  if (isApply) {
    console.log(`Successfully migrated:     ${migratedCount}`);
  } else {
    console.log(`Eligible for migration:    ${validCount}`);
    console.log('\nTo execute migration, re-run with:');
    console.log('  node server/scripts/migrate-avatars-to-db.mjs --apply');
  }
  console.log('----------------------------------------------\n');
}

main()
  .catch((err) => {
    console.error('Migration failed:', err.message);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

