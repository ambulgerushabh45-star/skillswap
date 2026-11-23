import { z } from "zod";

export const createMatchSchema = z.object({
  targetUserId: z
    .string({ message: "Target user ID is required" })
    .trim()
    .min(1, "Target user ID cannot be empty"),
  matchedSkillName: z
    .string()
    .trim()
    .max(60, "Matched skill name cannot exceed 60 characters")
    .optional(),
});

export const updateMatchStatusSchema = z.object({
  status: z.enum(["ACCEPTED", "DECLINED"], {
    message: "Status must be either ACCEPTED or DECLINED",
  }),
});

export const matchIdParamSchema = z.object({
  id: z
    .string({ message: "Match ID is required" })
    .trim()
    .min(1, "Match ID cannot be empty"),
});

