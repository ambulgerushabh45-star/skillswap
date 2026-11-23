import { z } from "zod";

export const getMessagesQuerySchema = z.object({
  matchId: z
    .string({ message: "matchId is required" })
    .trim()
    .min(1, "matchId cannot be empty"),
  limit: z
    .string()
    .optional()
    .refine(
      (val) => {
        if (val === undefined) return true;
        if (!/^\d+$/.test(val)) return false;
        const n = parseInt(val, 10);
        return n >= 1 && n <= 100;
      },
      { message: "limit must be an integer between 1 and 100" }
    )
    .transform((val) => (val !== undefined ? parseInt(val, 10) : undefined)),
  cursor: z
    .string()
    .trim()
    .min(1, "cursor cannot be empty")
    .optional(),
});

export const createMessageSchema = z.object({
  matchId: z
    .string({ message: "matchId is required" })
    .trim()
    .min(1, "matchId cannot be empty"),
  content: z
    .string({ message: "Message content is required" })
    .trim()
    .min(1, "Message content cannot be empty")
    .max(2000, "Message content cannot exceed 2000 characters"),
});

