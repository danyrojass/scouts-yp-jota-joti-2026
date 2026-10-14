import { z } from "zod";

export const memberRoleSchema = z.enum(["SCOUT", "DIRIGENTE", "OTRO"]);

const optionalText = (max: number) =>
  z.string().trim().max(max).nullable().optional();

export const createMemberSchema = z.object({
  eventId: z.string().min(1),
  teamId: z.string().min(1).nullable().optional(),
  firstName: z.string().trim().min(1, "El nombre es obligatorio").max(120),
  lastName: z.string().trim().min(1, "El apellido es obligatorio").max(120),
  document: optionalText(60),
  // Fecha ISO (YYYY-MM-DD) o vacio.
  birthDate: optionalText(30),
  role: memberRoleSchema.default("SCOUT"),
  phone: optionalText(40),
  notes: optionalText(500),
  active: z.boolean().default(true),
});

export const updateMemberSchema = createMemberSchema.partial().omit({ eventId: true });
