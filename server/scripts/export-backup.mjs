// server/scripts/export-backup.mjs
// Exports all SkillSwap MongoDB collections to JSON files in an external backup folder.
// Plain Node ESM. Never prints password hashes to the console.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { prisma } from '../src/db/prisma.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..', '..');

const customDir = process.argv.slice(2).find((a) => !a.startsWith('--'));
const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
const backupDir = customDir
  ? path.resolve(customDir)
  : path.resolve(rootDir, '..', 'skillswap-backups', timestamp);

async function main() {
  console.log('==============================================');
  console.log('MongoDB Collection Export Backup');
  console.log(`Target Backup Folder: ${backupDir}`);
  console.log('==============================================\n');

  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  const collections = [
    { name: 'User', fetch: () => prisma.user.findMany() },
    { name: 'Skill', fetch: () => prisma.skill.findMany() },
    { name: 'UserSkillsTeach', fetch: () => prisma.userSkillsTeach.findMany() },
    { name: 'UserSkillsLearn', fetch: () => prisma.userSkillsLearn.findMany() },
    { name: 'Match', fetch: () => prisma.match.findMany() },
    { name: 'Event', fetch: () => prisma.event.findMany() },
    { name: 'EventAttendee', fetch: () => prisma.eventAttendee.findMany() },
    { name: 'Review', fetch: () => prisma.review.findMany() },
    { name: 'Message', fetch: () => prisma.message.findMany() },
    { name: 'AvatarFile', fetch: () => prisma.avatarFile.findMany() },
  ];

  let totalDocs = 0;
  for (const { name, fetch } of collections) {
    const records = await fetch();
    const filePath = path.join(backupDir, `${name}.json`);
    fs.writeFileSync(filePath, JSON.stringify(records, null, 2), 'utf8');
    console.log(`  ✓ Exported ${name.padEnd(18)}: ${records.length} documents -> ${name}.json`);
    totalDocs += records.length;
  }

  console.log('\n----------------------------------------------');
  console.log(`Total documents exported: ${totalDocs}`);
  console.log(`Backup completed successfully at: ${backupDir}`);
  console.log('----------------------------------------------\n');
}

main()
  .catch((err) => {
    console.error('Export backup failed:', err.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

