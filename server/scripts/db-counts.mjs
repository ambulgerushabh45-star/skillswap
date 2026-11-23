import { prisma } from '../src/db/prisma.js';

async function main() {
  const counts = {
    users: await prisma.user.count(),
    skills: await prisma.skill.count(),
    userSkillsTeach: await prisma.userSkillsTeach.count(),
    userSkillsLearn: await prisma.userSkillsLearn.count(),
    matches: await prisma.match.count(),
    events: await prisma.event.count(),
    eventAttendees: await prisma.eventAttendee.count(),
    reviews: await prisma.review.count(),
    messages: await prisma.message.count(),
    avatarFiles: await prisma.avatarFile.count(),
    oAuthAccounts: await prisma.oAuthAccount.count(),
  };

  const baselineTotal = counts.users + counts.skills + counts.userSkillsTeach + counts.userSkillsLearn + counts.matches + counts.events + counts.eventAttendees + counts.reviews + counts.messages;
  console.log('Database Row Counts:', JSON.stringify({ ...counts, baselineTotal }, null, 2));
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

