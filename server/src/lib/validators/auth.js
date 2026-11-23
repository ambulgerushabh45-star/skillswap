import { z } from "zod";

export const registerSchema = z.object({
  name: z
    .string({ message: "Name is required" })
    .trim()
    .min(1, "Name cannot be empty")
    .max(80, "Name cannot exceed 80 characters"),
  email: z
    .string({ message: "Email is required" })
    .trim()
    .email("Invalid email address"),
  password: z
    .string({ message: "Password is required" })
    .min(8, "Password must be at least 8 characters long")
    .max(72, "Password cannot exceed 72 characters"),
});

