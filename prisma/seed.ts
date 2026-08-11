import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding database with Indian sample peers, skills, events, and reviews...");

  // Default skills
  const skillsData = [
    { name: "JavaScript / React", category: "Programming" },
    { name: "Python / Data Science", category: "Programming" },
    { name: "UI/UX Design (Figma)", category: "Design" },
    { name: "Spanish Conversation", category: "Languages" },
    { name: "Hindi Conversation", category: "Languages" },
    { name: "Acoustic Guitar", category: "Music" },
    { name: "Indian Cooking & Baking", category: "Culinary" },
    { name: "Digital Photography", category: "Arts" },
    { name: "Public Speaking", category: "Personal Growth" },
    { name: "Chess Strategy", category: "Games" },
  ];

  for (const s of skillsData) {
    await prisma.skill.upsert({
      where: { name: s.name },
      update: {},
      create: s,
    });
  }

  // Create demo user account (Alex Kumar) for immediate login testing
  const passwordHash = await bcrypt.hash("password123", 10);

  const demoUser = await prisma.user.upsert({
    where: { email: "alex@example.com" },
    update: { passwordHash },
    create: {
      name: "Alex Kumar",
      email: "alex@example.com",
      passwordHash,
      bio: "Final-year IT student passionate about building full-stack web apps and learning new skills!",
      location: "Koramangala, Bengaluru",
      avatarUrl: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80",
    },
  });

  // Assign demo user skills
  const reactSkill = await prisma.skill.findUnique({ where: { name: "JavaScript / React" } });
  const guitarSkill = await prisma.skill.findUnique({ where: { name: "Acoustic Guitar" } });

  if (reactSkill) {
    await prisma.userSkillsTeach.upsert({
      where: { userId_skillId: { userId: demoUser.id, skillId: reactSkill.id } },
      update: {},
      create: { userId: demoUser.id, skillId: reactSkill.id, proficiency: "Intermediate" },
    });
  }

  if (guitarSkill) {
    await prisma.userSkillsLearn.upsert({
      where: { userId_skillId: { userId: demoUser.id, skillId: guitarSkill.id } },
      update: {},
      create: { userId: demoUser.id, skillId: guitarSkill.id },
    });
  }

  // Create Indian peer users
  const peersData = [
    {
      name: "Aarav Sharma",
      email: "aarav.sharma@example.com",
      bio: "Senior CS student & frontend enthusiast. Happy to mentor React & UI/UX design!",
      location: "Koramangala, Bengaluru",
      avatarUrl: "https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=150&auto=format&fit=crop&q=80",
      teach: [{ name: "UI/UX Design (Figma)", proficiency: "Expert" }, { name: "JavaScript / React", proficiency: "Advanced" }],
      learn: ["Acoustic Guitar"],
    },
    {
      name: "Priya Patel",
      email: "priya.patel@example.com",
      bio: "Self-taught guitarist and music enthusiast. Eager to learn Python & web dev basics.",
      location: "Bandra West, Mumbai",
      avatarUrl: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80",
      teach: [{ name: "Acoustic Guitar", proficiency: "Advanced" }, { name: "Public Speaking", proficiency: "Intermediate" }],
      learn: ["JavaScript / React", "Python / Data Science"],
    },
    {
      name: "Rohan Verma",
      email: "rohan.verma@example.com",
      bio: "Food blogger & home chef. Excited to learn digital photography and web design.",
      location: "Connaught Place, New Delhi",
      avatarUrl: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80",
      teach: [{ name: "Hindi Conversation", proficiency: "Expert" }, { name: "Indian Cooking & Baking", proficiency: "Advanced" }],
      learn: ["Digital Photography", "UI/UX Design (Figma)"],
    },
    {
      name: "Ananya Iyer",
      email: "ananya.iyer@example.com",
      bio: "Freelance photographer & tech student. Love sharing camera lighting techniques!",
      location: "HSR Layout, Bengaluru",
      avatarUrl: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80",
      teach: [{ name: "Digital Photography", proficiency: "Expert" }, { name: "Python / Data Science", proficiency: "Intermediate" }],
      learn: ["Acoustic Guitar", "JavaScript / React"],
    },
  ];

  for (const p of peersData) {
    const u = await prisma.user.upsert({
      where: { email: p.email },
      update: { name: p.name, location: p.location, bio: p.bio, avatarUrl: p.avatarUrl },
      create: {
        name: p.name,
        email: p.email,
        bio: p.bio,
        location: p.location,
        avatarUrl: p.avatarUrl,
        passwordHash,
      },
    });

    for (const t of p.teach) {
      const sk = await prisma.skill.findUnique({ where: { name: t.name } });
      if (sk) {
        await prisma.userSkillsTeach.upsert({
          where: { userId_skillId: { userId: u.id, skillId: sk.id } },
          update: {},
          create: { userId: u.id, skillId: sk.id, proficiency: t.proficiency },
        });
      }
    }

    for (const lName of p.learn) {
      const sk = await prisma.skill.findUnique({ where: { name: lName } });
      if (sk) {
        await prisma.userSkillsLearn.upsert({
          where: { userId_skillId: { userId: u.id, skillId: sk.id } },
          update: {},
          create: { userId: u.id, skillId: sk.id },
        });
      }
    }

    // Add a sample review for Priya Patel
    if (p.name === "Priya Patel") {
      const priyaUser = await prisma.user.findUnique({ where: { email: p.email } });
      if (priyaUser) {
        await prisma.review.create({
          data: {
            fromUserId: demoUser.id,
            toUserId: priyaUser.id,
            rating: 5,
            comment: "Priya is an amazing acoustic guitar teacher! Patient, clear, and super helpful.",
          },
        });
      }
    }
  }

  // Create sample events
  const priyaUser = await prisma.user.findUnique({ where: { email: "priya.patel@example.com" } });
  const hostId = priyaUser ? priyaUser.id : demoUser.id;

  const eventsData = [
    {
      title: "React & Next.js Chai & Code Study Session",
      description: "Bring your laptop! We are practicing Next.js App Router, Tailwind CSS, and React hooks over chai & coffee.",
      location: "Third Wave Coffee, Koramangala, Bengaluru",
      lat: 12.9352,
      lng: 77.6245,
      dateTime: new Date(Date.now() + 86400000 * 2),
    },
    {
      title: "Acoustic Guitar Jam & Music Circle",
      description: "Open acoustic music circle in the park for beginners and intermediate guitar players. Chords & song sharing!",
      location: "Cubbon Park Gazebo, Bengaluru",
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
      },
    });

    await prisma.eventAttendee.create({
      data: {
        eventId: eventRecord.id,
        userId: hostId,
        status: "GOING",
      },
    });
  }

  console.log("Database seeded successfully!");
}

main()
  .catch((e) => {
    console.error("Error seeding database:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
