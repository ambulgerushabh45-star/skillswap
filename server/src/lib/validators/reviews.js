import { z } from "zod";

export const getReviewsQuerySchema = z.object({
  toUserId: z
    .string({ message: "toUserId is required" })
    .trim()
    .min(1, "toUserId cannot be empty"),
  page: z
    .string()
    .optional()
    .refine((val) => val === undefined || (/^\d+$/.test(val) && parseInt(val, 10) >= 1), {
      message: "page must be a positive integer",
    })
    .transform((val) => (val !== undefined ? parseInt(val, 10) : undefined)),
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
});

export const createReviewSchema = z.object({
  toUserId: z
    .string({ message: "toUserId is required" })
    .trim()
    .min(1, "toUserId cannot be empty"),
  rating: z.coerce
    .number({ message: "Rating must be a valid number" })
    .int("Rating must be an integer")
    .min(1, "Rating must be between 1 and 5 stars")
    .max(5, "Rating must be between 1 and 5 stars"),
  comment: z
    .string({ message: "Comment is required" })
    .trim()
    .min(1, "Comment cannot be empty")
    .max(1000, "Comment cannot exceed 1000 characters"),
});

