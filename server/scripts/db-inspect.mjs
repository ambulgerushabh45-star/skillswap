import { prisma } from '../src/db/prisma.js';

async function main() {
  console.log('=== USERS & IDS ===');
  const users = await prisma.user.findMany({ select: { id: true, email: true, name: true } });
  console.log(`Total users: ${users.length}`);
  for (const u of users) {
    console.log(`User ID: ${u.id} | Email: ${u.email} | Name: ${u.name}`);
  }

  const upperCaseEmails = users.filter((u) => u.email !== u.email.toLowerCase());
  console.log(`\nUsers with uppercase letters in email: ${upperCaseEmails.length}`);

  console.log('\n=== ROW COUNTS PER TABLE ===');
  const userCount = await prisma.user.count();
  const skillCount = await prisma.skill.count();
  const teachCount = await prisma.userSkillsTeach.count();
  const learnCount = await prisma.userSkillsLearn.count();
  const matchCount = await prisma.match.count();
  const eventCount = await prisma.event.count();
  const attendeeCount = await prisma.eventAttendee.count();
  const reviewCount = await prisma.review.count();
  const messageCount = await prisma.message.count();

  console.log(`User: ${userCount}`);
  console.log(`Skill: ${skillCount}`);
  console.log(`UserSkillsTeach: ${teachCount}`);
  console.log(`UserSkillsLearn: ${learnCount}`);
  console.log(`Match: ${matchCount}`);
  console.log(`Event: ${eventCount}`);
  console.log(`EventAttendee: ${attendeeCount}`);
  console.log(`Review: ${reviewCount}`);
  console.log(`Message: ${messageCount}`);

  console.log('\n=== DISTINCT ENUM VALUES ===');
  const matchStatuses = await prisma.match.findMany({
    select: { status: true },
    distinct: ['status'],
  });
  console.log('Match.status distinct values:', matchStatuses.map((m) => m.status));

  const attendeeStatuses = await prisma.eventAttendee.findMany({
    select: { status: true },
    distinct: ['status'],
  });
  console.log('EventAttendee.status distinct values:', attendeeStatuses.map((a) => a.status));

  const teachProficiencies = await prisma.userSkillsTeach.findMany({
    select: { proficiency: true },
    distinct: ['proficiency'],
  });
  console.log('UserSkillsTeach.proficiency distinct values:', teachProficiencies.map((t) => t.proficiency));

  console.log('\n=== CHECKING FOR DUPLICATES ===');
  async function findDuplicates(modelName, fields) {
    const records = await prisma[modelName].findMany({
      select: Object.fromEntries(fields.map((f) => [f, true])),
    });
    const map = new Map();
    const dupes = [];
    for (const r of records) {
      const key = fields.map((f) => r[f]).join(':::');
      const count = (map.get(key) || 0) + 1;
      map.set(key, count);
      if (count === 2) {
        dupes.push(r);
      }
    }
    return dupes;
  }

  const teachDupes = await findDuplicates('userSkillsTeach', ['userId', 'skillId']);
  console.log('UserSkillsTeach duplicates:', teachDupes);

  const learnDupes = await findDuplicates('userSkillsLearn', ['userId', 'skillId']);
  console.log('UserSkillsLearn duplicates:', learnDupes);

  const attendeeDupes = await findDuplicates('eventAttendee', ['eventId', 'userId']);
  console.log('EventAttendee duplicates:', attendeeDupes);

  const matchDupes = await findDuplicates('match', ['userAId', 'userBId', 'matchedSkillId']);
  console.log('Match duplicates (userA, userB, skill):', matchDupes);

  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  console.log('\n=== UUID VALIDATION ACROSS ALL TABLES ===');
  const tables = ['user', 'skill', 'userSkillsTeach', 'userSkillsLearn', 'match', 'event', 'eventAttendee', 'review', 'message'];
  for (const t of tables) {
    const rows = await prisma[t].findMany({ select: { id: true } });
    const nonUuid = rows.filter((r) => !uuidRegex.test(r.id));
    console.log(`${t} total: ${rows.length}, non-UUID count: ${nonUuid.length}`);
    if (nonUuid.length > 0) {
      console.log(`  Non-UUID examples in ${t}:`, nonUuid.slice(0, 3));
    }
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

