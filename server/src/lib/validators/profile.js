import { z } from "zod";

export const skillTeachItemSchema = z.object({
  name: z
    .string({ message: "Skill name is required" })
    .trim()
    .min(1, "Skill name cannot be empty")
    .max(60, "Skill name cannot exceed 60 characters"),
  proficiency: z.enum(
    ["Beginner", "Intermediate", "Advanced", "Expert"],
    { message: "Proficiency must be Beginner, Intermediate, Advanced, or Expert" }
  ),
  category: z.string().trim().max(60).optional(),
});

export const skillLearnItemSchema = z.object({
  name: z
    .string({ message: "Skill name is required" })
    .trim()
    .min(1, "Skill name cannot be empty")
    .max(60, "Skill name cannot exceed 60 characters"),
  category: z.string().trim().max(60).optional(),
});

const AVATAR_FILE_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}-[0-9a-f]{16}\.webp$/;

function isValidAvatarUrlFormat(val) {
  if (!val) return true;
  if (val.startsWith("http://") || val.startsWith("https://")) {
    try {
      new URL(val);
      return true;
    } catch {
      return false;
    }
  }
  if (val.startsWith("/api/avatars/")) {
    const fileName = val.slice("/api/avatars/".length);
    return AVATAR_FILE_REGEX.test(fileName);
  }
  return false;
}

export const updateProfileSchema = z.object({
  bio: z
    .string()
    .trim()
    .max(500, "Bio cannot exceed 500 characters")
    .optional()
    .nullable(),
  location: z
    .string()
    .trim()
    .max(100, "Location cannot exceed 100 characters")
    .optional()
    .nullable(),
  latitude: z
    .number({ message: "Latitude must be a valid number" })
    .min(-90, "Latitude must be between -90 and 90")
    .max(90, "Latitude must be between -90 and 90")
    .optional()
    .nullable(),
  longitude: z
    .number({ message: "Longitude must be a valid number" })
    .min(-180, "Longitude must be between -180 and 180")
    .max(180, "Longitude must be between -180 and 180")
    .optional()
    .nullable(),
  avatarUrl: z
    .string()
    .trim()
    .refine(isValidAvatarUrlFormat, {
      message: "Avatar must be a valid URL",
    })
    .optional()
    .nullable(),
  skillsTeach: z.array(skillTeachItemSchema).max(50).optional(),
  skillsLearn: z.array(skillLearnItemSchema).max(50).optional(),
  emailNotifications: z.boolean().optional(),
});

export const deleteAccountSchema = z.object({
  confirm: z.literal("DELETE", {
    errorMap: () => ({ message: "confirm must be DELETE" }),
  }),
  password: z.string().optional(),
});

export const userIdParamSchema = z.object({
  id: z
    .string({ message: "User ID is required" })
    .trim()
    .min(1, "User ID cannot be empty"),
});

