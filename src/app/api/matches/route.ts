import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// Simple Indian peer profiles for local community matching
const SAMPLE_PEERS = [
  {
    name: "Aarav Sharma",
    email: "aarav.sharma@example.com",
    bio: "Final-year IT student passionate about React & UI/UX design. Wanting to learn Acoustic Guitar!",
    location: "Koramangala, Bengaluru",
    avatarUrl: "https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=150&auto=format&fit=crop&q=80",
    teach: [{ name: "UI/UX Design (Figma)", category: "Design", proficiency: "Expert" }, { name: "JavaScript / React", category: "Programming", proficiency: "Advanced" }],
    learn: [{ name: "Acoustic Guitar", category: "Music" }],
  },
  {
    name: "Priya Patel",
    email: "priya.patel@example.com",
    bio: "Self-taught acoustic guitarist & music lover. Wanting to learn Python for data analysis.",
    location: "Bandra West, Mumbai",
    avatarUrl: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80",
    teach: [{ name: "Acoustic Guitar", category: "Music", proficiency: "Advanced" }, { name: "Public Speaking", category: "Personal Growth", proficiency: "Intermediate" }],
    learn: [{ name: "JavaScript / React", category: "Programming" }, { name: "Python / Data Science", category: "Programming" }],
  },
  {
    name: "Rohan Verma",
    email: "rohan.verma@example.com",
    bio: "Food blogger & home chef. Excited to learn digital photography and web design basics.",
    location: "Connaught Place, New Delhi",
    avatarUrl: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80",
    teach: [{ name: "Hindi Conversation", category: "Languages", proficiency: "Expert" }, { name: "Indian Cooking & Baking", category: "Culinary", proficiency: "Advanced" }],
    learn: [{ name: "Digital Photography", category: "Arts" }, { name: "UI/UX Design (Figma)", category: "Design" }],
  },
  {
    name: "Ananya Iyer",
    email: "ananya.iyer@example.com",
    bio: "Freelance photographer & tech student. Love sharing camera lighting techniques!",
    location: "HSR Layout, Bengaluru",
    avatarUrl: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80",
    teach: [{ name: "Digital Photography", category: "Arts", proficiency: "Expert" }, { name: "Python / Data Science", category: "Programming", proficiency: "Intermediate" }],
    learn: [{ name: "Acoustic Guitar", category: "Music" }, { name: "JavaScript / React", category: "Programming" }],
  },
];

export async function ensureSamplePeersExist() {
  const count = await prisma.user.count();
  if (count < 3) {
    for (const p of SAMPLE_PEERS) {
      const user = await prisma.user.upsert({
        where: { email: p.email },
        update: { name: p.name, location: p.location, bio: p.bio, avatarUrl: p.avatarUrl },
        create: {
          name: p.name,
          email: p.email,
          bio: p.bio,
          location: p.location,
          avatarUrl: p.avatarUrl,
        },
      });

      // Add teaching skills
      for (const t of p.teach) {
        const skill = await prisma.skill.upsert({
          where: { name: t.name },
          update: {},
          create: { name: t.name, category: t.category },
        });

        await prisma.userSkillsTeach.upsert({
          where: { userId_skillId: { userId: user.id, skillId: skill.id } },
          update: {},
          create: { userId: user.id, skillId: skill.id, proficiency: t.proficiency },
        });
      }

      // Add learning skills
      for (const l of p.learn) {
        const skill = await prisma.skill.upsert({
          where: { name: l.name },
          update: {},
          create: { name: l.name, category: l.category },
        });

        await prisma.userSkillsLearn.upsert({
          where: { userId_skillId: { userId: user.id, skillId: skill.id } },
          update: {},
          create: { userId: user.id, skillId: skill.id },
        });
      }
    }
  }
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Ensure database has sample Indian peers
    await ensureSamplePeersExist();

    // Get current user details with skills
    const currentUser = await prisma.user.findUnique({
      where: { email: session.user.email },
      include: {
        skillsTeach: { include: { skill: true } },
        skillsLearn: { include: { skill: true } },
      },
    });

    if (!currentUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Current user's skill sets
    const userTeachSkillNames = currentUser.skillsTeach.map((st) => st.skill.name.toLowerCase());
    const userLearnSkillNames = currentUser.skillsLearn.map((sl) => sl.skill.name.toLowerCase());

    // Fetch all other users
    const otherUsers = await prisma.user.findMany({
      where: {
        id: { not: currentUser.id },
      },
      include: {
        skillsTeach: { include: { skill: true } },
        skillsLearn: { include: { skill: true } },
        reviewsReceived: { select: { rating: true } },
      },
    });

    // Fetch existing matches for current user
    const matches = await prisma.match.findMany({
      where: {
        OR: [{ userAId: currentUser.id }, { userBId: currentUser.id }],
      },
    });

    // Compute matches
    const matchResults = otherUsers.map((peer) => {
      const peerTeachSkillNames = peer.skillsTeach.map((st) => st.skill.name.toLowerCase());
      const peerLearnSkillNames = peer.skillsLearn.map((sl) => sl.skill.name.toLowerCase());

      // Calculate average rating
      const totalReviews = peer.reviewsReceived.length;
      const avgRating =
        totalReviews > 0
          ? parseFloat((peer.reviewsReceived.reduce((s, r) => s + r.rating, 0) / totalReviews).toFixed(1))
          : 4.9;

      // Check mutual match
      const matchingSkillsUserWants = peer.skillsTeach.filter((st) =>
        userLearnSkillNames.includes(st.skill.name.toLowerCase())
      );

      const matchingSkillsPeerWants = currentUser.skillsTeach.filter((st) =>
        peerLearnSkillNames.includes(st.skill.name.toLowerCase())
      );

      const isMutual = matchingSkillsUserWants.length > 0 && matchingSkillsPeerWants.length > 0;

      // Connection status in DB
      const existingMatch = matches.find(
        (m) =>
          (m.userAId === currentUser.id && m.userBId === peer.id) ||
          (m.userAId === peer.id && m.userBId === currentUser.id)
      );

      let connectionStatus = "NONE";
      let matchId = null;

      if (existingMatch) {
        connectionStatus = existingMatch.status;
        matchId = existingMatch.id;
      }

      // Highlight matched skill string
      let matchedSkillName = "General Skill Swap";
      if (matchingSkillsUserWants.length > 0) {
        matchedSkillName = matchingSkillsUserWants[0].skill.name;
      } else if (peer.skillsTeach.length > 0) {
        matchedSkillName = peer.skillsTeach[0].skill.name;
      }

      return {
        id: peer.id,
        name: peer.name,
        email: peer.email,
        bio: peer.bio || "No bio added yet.",
        location: peer.location || "Nearby",
        avatarUrl: peer.avatarUrl || "",
        avgRating,
        reviewCount: totalReviews,
        isMutual,
        matchedSkillName,
        connectionStatus,
        matchId,
        skillsTeach: peer.skillsTeach.map((st) => ({
          id: st.skill.id,
          name: st.skill.name,
          proficiency: st.proficiency,
        })),
        skillsLearn: peer.skillsLearn.map((sl) => ({
          id: sl.skill.id,
          name: sl.skill.name,
        })),
      };
    });

    return NextResponse.json({
      currentUser: {
        id: currentUser.id,
        name: currentUser.name,
        email: currentUser.email,
        location: currentUser.location,
        teachCount: currentUser.skillsTeach.length,
        learnCount: currentUser.skillsLearn.length,
      },
      matches: matchResults,
    });
  } catch (error) {
    console.error("Error in GET /api/matches:", error);
    return NextResponse.json({ error: "Failed to load matches" }, { status: 500 });
  }
}

// POST /api/matches — Connect request
export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { targetUserId, matchedSkillName } = await req.json();

    if (!targetUserId) {
      return NextResponse.json({ error: "Target user ID is required" }, { status: 400 });
    }

    const currentUser = await prisma.user.findUnique({
      where: { email: session.user.email },
    });

    if (!currentUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const skill = await prisma.skill.upsert({
      where: { name: matchedSkillName || "General Skill Swap" },
      update: {},
      create: { name: matchedSkillName || "General Skill Swap", category: "General" },
    });

    const existingMatch = await prisma.match.findFirst({
      where: {
        OR: [
          { userAId: currentUser.id, userBId: targetUserId },
          { userAId: targetUserId, userBId: currentUser.id },
        ],
      },
    });

    if (existingMatch) {
      return NextResponse.json({ message: "Connection request already exists", match: existingMatch });
    }

    const newMatch = await prisma.match.create({
      data: {
        userAId: currentUser.id,
        userBId: targetUserId,
        matchedSkillId: skill.id,
        status: "PENDING",
      },
    });

    return NextResponse.json({ message: "Connection request sent!", match: newMatch }, { status: 201 });
  } catch (error) {
    console.error("Error creating match connection:", error);
    return NextResponse.json({ error: "Failed to send connection request" }, { status: 500 });
  }
}
