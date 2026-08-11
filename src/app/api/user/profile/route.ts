import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET current user profile
export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      include: {
        skillsTeach: {
          include: { skill: true },
        },
        skillsLearn: {
          include: { skill: true },
        },
      },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json({ user });
  } catch (error) {
    console.error("Error fetching user profile:", error);
    return NextResponse.json({ error: "Failed to load profile" }, { status: 500 });
  }
}

// PUT update user profile (bio, location, teach skills, learn skills)
export async function PUT(req: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { bio, location, avatarUrl, skillsTeach, skillsLearn } = body;

    // 1. Update basic user info
    const updatedUser = await prisma.user.update({
      where: { email: session.user.email },
      data: {
        bio: bio || null,
        location: location || null,
        avatarUrl: avatarUrl || null,
      },
    });

    // 2. Update skills to teach if provided
    if (Array.isArray(skillsTeach)) {
      // Clear old taught skills for user
      await prisma.userSkillsTeach.deleteMany({
        where: { userId: updatedUser.id },
      });

      // Insert new taught skills
      for (const item of skillsTeach) {
        // Ensure skill exists in Skill table
        const skill = await prisma.skill.upsert({
          where: { name: item.name.trim() },
          update: {},
          create: { name: item.name.trim(), category: item.category || "General" },
        });

        await prisma.userSkillsTeach.create({
          data: {
            userId: updatedUser.id,
            skillId: skill.id,
            proficiency: item.proficiency || "Intermediate",
          },
        });
      }
    }

    // 3. Update skills to learn if provided
    if (Array.isArray(skillsLearn)) {
      // Clear old learned skills for user
      await prisma.userSkillsLearn.deleteMany({
        where: { userId: updatedUser.id },
      });

      // Insert new learned skills
      for (const item of skillsLearn) {
        // Ensure skill exists in Skill table
        const skill = await prisma.skill.upsert({
          where: { name: item.name.trim() },
          update: {},
          create: { name: item.name.trim(), category: item.category || "General" },
        });

        await prisma.userSkillsLearn.create({
          data: {
            userId: updatedUser.id,
            skillId: skill.id,
          },
        });
      }
    }

    // Fetch full updated user
    const fullUser = await prisma.user.findUnique({
      where: { id: updatedUser.id },
      include: {
        skillsTeach: { include: { skill: true } },
        skillsLearn: { include: { skill: true } },
      },
    });

    return NextResponse.json({ message: "Profile updated successfully", user: fullUser });
  } catch (error) {
    console.error("Error updating profile:", error);
    return NextResponse.json({ error: "Failed to update profile" }, { status: 500 });
  }
}
