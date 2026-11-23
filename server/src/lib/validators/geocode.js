import { z } from "zod";

export const geocodeQuerySchema = z.object({
  q: z
    .string({ message: "Search query is required" })
    .trim()
    .min(3, "Search query must be at least 3 characters")
    .max(200, "Search query cannot exceed 200 characters"),
});

