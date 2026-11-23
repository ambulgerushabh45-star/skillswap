import { z } from "zod";

export const SKILL_CATEGORIES = [
  "Programming",
  "Design",
  "Languages",
  "Music",
  "Culinary",
  "Arts",
  "Personal Growth",
  "Games",
  "Health",
  "General",
];

export const createSkillSchema = z.object({
  name: z
    .string({ message: "Skill name is required" })
    .trim()
    .min(1, "Skill name cannot be empty")
    .max(60, "Skill name cannot exceed 60 characters"),
  category: z
    .enum(SKILL_CATEGORIES, {
      message: `Category must be one of: ${SKILL_CATEGORIES.join(", ")}`,
    })
    .default("General"),
});

