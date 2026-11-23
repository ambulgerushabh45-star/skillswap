import { z } from "zod";

const coordinateValidator = (name, min, max) =>
  z.preprocess((val) => {
    if (val === "" || val === null || val === undefined) return undefined;
    if (typeof val === "string") {
      const num = Number(val);
      return isNaN(num) ? val : num;
    }
    return val;
  }, z
    .number({ message: `${name} must be a valid number` })
    .min(min, `${name} must be between ${min} and ${max}`)
    .max(max, `${name} must be between ${min} and ${max}`)
    .optional());

export const createEventSchema = z.object({
  title: z
    .string({ message: "Title is required" })
    .trim()
    .min(1, "Title cannot be empty")
    .max(120, "Title cannot exceed 120 characters"),
  description: z
    .string({ message: "Description is required" })
    .trim()
    .min(1, "Description cannot be empty")
    .max(1000, "Description cannot exceed 1000 characters"),
  location: z
    .string({ message: "Location is required" })
    .trim()
    .min(1, "Location cannot be empty")
    .max(200, "Location cannot exceed 200 characters"),
  dateTime: z
    .string({ message: "Date & time is required" })
    .trim()
    .refine((val) => !isNaN(Date.parse(val)), { message: "Invalid date format" }),
  lat: coordinateValidator("Latitude", -90, 90),
  lng: coordinateValidator("Longitude", -180, 180),
  maxAttendees: z
    .number({ message: "maxAttendees must be a valid number" })
    .int("maxAttendees must be an integer")
    .min(1, "maxAttendees must be between 1 and 1000")
    .max(1000, "maxAttendees must be between 1 and 1000")
    .nullable()
    .optional(),
});

export const patchEventSchema = z
  .object({
    title: z
      .string({ message: "Title must be a string" })
      .trim()
      .min(1, "Title cannot be empty")
      .max(120, "Title cannot exceed 120 characters")
      .optional(),
    description: z
      .string({ message: "Description must be a string" })
      .trim()
      .min(1, "Description cannot be empty")
      .max(1000, "Description cannot exceed 1000 characters")
      .optional(),
    location: z
      .string({ message: "Location must be a string" })
      .trim()
      .min(1, "Location cannot be empty")
      .max(200, "Location cannot exceed 200 characters")
      .optional(),
    dateTime: z
      .string({ message: "Date & time must be a string" })
      .trim()
      .refine((val) => !isNaN(Date.parse(val)), { message: "Invalid date format" })
      .optional(),
    lat: coordinateValidator("Latitude", -90, 90),
    lng: coordinateValidator("Longitude", -180, 180),
    maxAttendees: z
      .number({ message: "maxAttendees must be a valid number" })
      .int("maxAttendees must be an integer")
      .min(1, "maxAttendees must be between 1 and 1000")
      .max(1000, "maxAttendees must be between 1 and 1000")
      .nullable()
      .optional(),
  })
  .refine(
    (data) => Object.values(data).some((val) => val !== undefined),
    { message: "At least one field must be provided for update" }
  );

export const eventIdParamSchema = z.object({
  id: z
    .string({ message: "Event ID is required" })
    .trim()
    .min(1, "Event ID cannot be empty"),
});
