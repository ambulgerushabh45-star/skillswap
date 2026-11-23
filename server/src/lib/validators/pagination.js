import { z } from "zod";

/**
 * Common pagination query schema for offset/page-based list endpoints.
 * Both fields are optional.
 * When provided:
 * - page must be an integer >= 1
 * - limit must be an integer between 1 and 100
 */
export const pagePaginationQuerySchema = z.object({
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
      {
        message: "limit must be an integer between 1 and 100",
      }
    )
    .transform((val) => (val !== undefined ? parseInt(val, 10) : undefined)),
});

