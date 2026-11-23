// server/scripts/seed.mjs
// ESM seed script for SkillSwap on MongoDB. Refuses to run if any users exist.

import bcrypt from 'bcryptjs';
import { prisma } from '../src/db/prisma.js';

async function main() {
  const existingUserCount = await prisma.user.count();
  if (existingUserCount > 0) {
    console.error(`Refusing to seed: database already contains ${existingUserCount} user(s). Seed only runs on empty databases.`);
    process.exit(1);
  }

  console.log('Seeding MongoDB database with Indian sample peers, skills, events, and reviews...');

  // Default skills
  const skillsData = [
    { name: 'JavaScript / React', category: 'Programming' },
    { name: 'Python / Data Science', category: 'Programming' },
    { name: 'UI/UX Design (Figma)', category: 'Design' },
    { name: 'Spanish Conversation', category: 'Languages' },
    { name: 'Hindi Conversation', category: 'Languages' },
    { name: 'Acoustic Guitar', category: 'Music' },
    { name: 'Indian Cooking & Baking', category: 'Culinary' },
    { name: 'Digital Photography', category: 'Arts' },
    { name: 'Public Speaking', category: 'Personal Growth' },
    { name: 'Chess Strategy', category: 'Games' },
  ];

  for (const s of skillsData) {
    await prisma.skill.upsert({
      where: { name: s.name },
      update: {},
      create: s,
    });
  }

  // Create demo user account (Alex Kumar) for immediate login testing
  const passwordHash = await bcrypt.hash('password123', 10);

  const demoUser = await prisma.user.create({
    data: {
      name: 'Alex Kumar',
      email: 'alex@example.com',
      passwordHash,
      bio: 'Final-year IT student passionate about building full-stack web apps and learning new skills!',
      location: 'Koramangala, Bengaluru',
      latitude: 12.9352,
      longitude: 77.6245,
      avatarUrl: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80',
    },
  });

  // Assign demo user skills
  const reactSkill = await prisma.skill.findUnique({ where: { name: 'JavaScript / React' } });
  const guitarSkill = await prisma.skill.findUnique({ where: { name: 'Acoustic Guitar' } });

  if (reactSkill) {
    await prisma.userSkillsTeach.create({
      data: { userId: demoUser.id, skillId: reactSkill.id, proficiency: 'Intermediate' },
    });
  }

  if (guitarSkill) {
    await prisma.userSkillsLearn.create({
      data: { userId: demoUser.id, skillId: guitarSkill.id },
    });
  }

  // Create Indian peer users
  const peersData = [
    {
      name: 'Aarav Sharma',
      email: 'aarav.sharma@example.com',
      bio: 'Senior CS student & frontend enthusiast. Happy to mentor React & UI/UX design!',
      location: 'Koramangala, Bengaluru',
      latitude: 12.9352,
      longitude: 77.6245,
      avatarUrl: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=150&auto=format&fit=crop&q=80',
      teach: [{ name: 'UI/UX Design (Figma)', proficiency: 'Expert' }, { name: 'JavaScript / React', proficiency: 'Advanced' }],
      learn: ['Acoustic Guitar'],
    },
    {
      name: 'Priya Patel',
      email: 'priya.patel@example.com',
      bio: 'Self-taught guitarist and music enthusiast. Eager to learn Python & web dev basics.',
      location: 'Bandra West, Mumbai',
      latitude: 19.0596,
      longitude: 72.8295,
      avatarUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80',
      teach: [{ name: 'Acoustic Guitar', proficiency: 'Advanced' }, { name: 'Public Speaking', proficiency: 'Intermediate' }],
      learn: ['JavaScript / React', 'Python / Data Science'],
    },
    {
      name: 'Rohan Verma',
      email: 'rohan.verma@example.com',
      bio: 'Food blogger & home chef. Excited to learn digital photography and web design.',
      location: 'Connaught Place, New Delhi',
      latitude: 28.6315,
      longitude: 77.2167,
      avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
      teach: [{ name: 'Hindi Conversation', proficiency: 'Expert' }, { name: 'Indian Cooking & Baking', proficiency: 'Advanced' }],
      learn: ['Digital Photography', 'UI/UX Design (Figma)'],
    },
    {
      name: 'Ananya Iyer',
      email: 'ananya.iyer@example.com',
      bio: 'Freelance photographer & tech student. Love sharing camera lighting techniques!',
      location: 'HSR Layout, Bengaluru',
      latitude: 12.9116,
      longitude: 77.6389,
      avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
      teach: [{ name: 'Digital Photography', proficiency: 'Expert' }, { name: 'Python / Data Science', proficiency: 'Intermediate' }],
      learn: ['Acoustic Guitar', 'JavaScript / React'],
    },
  ];

  for (const p of peersData) {
    const u = await prisma.user.create({
      data: {
        name: p.name,
        email: p.email,
        bio: p.bio,
        location: p.location,
        latitude: p.latitude,
        longitude: p.longitude,
        avatarUrl: p.avatarUrl,
        passwordHash,
      },
    });

    for (const t of p.teach) {
      const sk = await prisma.skill.findUnique({ where: { name: t.name } });
      if (sk) {
        await prisma.userSkillsTeach.create({
          data: { userId: u.id, skillId: sk.id, proficiency: t.proficiency },
        });
      }
    }

    for (const lName of p.learn) {
      const sk = await prisma.skill.findUnique({ where: { name: lName } });
      if (sk) {
        await prisma.userSkillsLearn.create({
          data: { userId: u.id, skillId: sk.id },
        });
      }
    }

    if (p.name === 'Priya Patel') {
      await prisma.review.create({
        data: {
          fromUserId: demoUser.id,
          toUserId: u.id,
          rating: 5,
          comment: 'Priya is an amazing acoustic guitar teacher! Patient, clear, and super helpful.',
        },
      });
    }
  }

  const priyaUser = await prisma.user.findUnique({ where: { email: 'priya.patel@example.com' } });
  const hostId = priyaUser ? priyaUser.id : demoUser.id;

  const eventsData = [
    {
      title: 'React & Node.js Chai & Code Study Session',
      description: 'Bring your laptop! We are practicing full-stack React, Express, and Tailwind CSS over chai & coffee.',
      location: 'Third Wave Coffee, Koramangala, Bengaluru',
      lat: 12.9352,
      lng: 77.6245,
      dateTime: new Date(Date.now() + 86400000 * 2),
    },
    {
      title: 'Acoustic Guitar Jam & Music Circle',
      description: 'Open acoustic music circle in the park for beginners and intermediate guitar players. Chords & song sharing!',
      location: 'Cubbon Park Gazebo, Bengaluru',
      lat: 12.9763,
      lng: 77.5929,
      dateTime: new Date(Date.now() + 86400000 * 4),
    },
  ];

  for (const ev of eventsData) {
    const eventRecord = await prisma.event.create({
      data: {
        hostId,
        title: ev.title,
        description: ev.description,
        location: ev.location,
        lat: ev.lat,
        lng: ev.lng,
        dateTime: ev.dateTime,
        cancelledAt: null,
      },
    });

    await prisma.eventAttendee.create({
      data: {
        eventId: eventRecord.id,
        userId: hostId,
        status: 'GOING',
      },
    });
  }

  console.log('MongoDB database seeded successfully!');
}

main()
  .catch((e) => {
    console.error('Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

