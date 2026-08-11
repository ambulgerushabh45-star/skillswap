import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Default seed skills for fresh installations
const DEFAULT_SKILLS = [
  { name: "JavaScript / React", category: "Programming" },
  { name: "Python / Data Science", category: "Programming" },
  { name: "UI/UX Design (Figma)", category: "Design" },
  { name: "Spanish Conversation", category: "Languages" },
  { name: "Acoustic Guitar", category: "Music" },
  { name: "Italian Cooking", category: "Culinary" },
  { name: "Digital Photography", category: "Arts" },
  { name: "Public Speaking", category: "Personal Growth" },
  { name: "Chess Strategy", category: "Games" },
  { name: "Fitness & Yoga", category: "Health" },
];

export async function GET() {
  try {
    let skills = await prisma.skill.findMany({
      orderBy: { name: "asc" },
    });

    // Seed default skills if database table is empty
    if (skills.length === 0) {
      for (const item of DEFAULT_SKILLS) {
        await prisma.skill.create({ data: item });
      }

      skills = await prisma.skill.findMany({
        orderBy: { name: "asc" },
      });
    }

    return NextResponse.json({ skills });
  } catch (error) {
    console.error("Error fetching skills:", error);
    return NextResponse.json({ error: "Failed to fetch skills" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { name, category } = await req.json();

    if (!name) {
      return NextResponse.json({ error: "Skill name is required" }, { status: 400 });
    }

    // Upsert skill
    const skill = await prisma.skill.upsert({
      where: { name: name.trim() },
      update: {},
      create: {
        name: name.trim(),
        category: category || "General",
      },
    });

    return NextResponse.json({ skill }, { status: 201 });
  } catch (error) {
    console.error("Error creating skill:", error);
    return NextResponse.json({ error: "Failed to create skill" }, { status: 500 });
  }
}
