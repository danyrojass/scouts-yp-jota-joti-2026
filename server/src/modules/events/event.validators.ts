import { z } from "zod";

export const createEventSchema = z.object({
  name: z.string().trim().min(3, "El nombre es obligatorio").max(120),
  description: z.string().trim().max(2000).optional().nullable(),
  date: z.coerce.date(),
  location: z.string().trim().max(200).optional().nullable(),
  status: z.enum(["PREPARED", "IN_PROGRESS", "FINISHED", "CANCELLED"]).default("PREPARED"),
});

export const updateEventSchema = createEventSchema.partial().extend({
  status: z.enum(["PREPARED", "IN_PROGRESS", "FINISHED", "CANCELLED"]).optional(),
});