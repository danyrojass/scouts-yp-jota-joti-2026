import { z } from "zod";

export const usernameSchema = z
  .string()
  .trim()
  .min(3, "El usuario debe tener al menos 3 caracteres")
  .max(64, "El usuario es demasiado largo")
  .regex(/^[a-zA-Z0-9_.]+$/, "Solo letras, numeros, punto y guion bajo");

export const passwordSchema = z
  .string()
  .min(6, "La contrasena debe tener al menos 6 caracteres")
  .max(128, "La contrasena es demasiado larga");

export const createTeamSchema = z.object({
  name: z.string().trim().min(1, "El nombre es obligatorio").max(120),
  username: usernameSchema,
  password: passwordSchema,
  active: z.boolean().default(true),
});

export const updateTeamSchema = z.object({
  name: z.string().trim().min(1, "El nombre es obligatorio").max(120).optional(),
  password: passwordSchema.optional(),
  active: z.boolean().optional(),
});

/** A team editing its own profile (display name only). */
export const updateProfileSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "El nombre es obligatorio")
    .max(120, "El nombre es demasiado largo"),
});

export const setRouteSchema = z.object({
  stationIds: z
    .array(z.string().min(1))
    .min(2, "El itinerario debe tener al menos 2 postas")
    .refine(
      (ids) => new Set(ids).size === ids.length,
      "No se permiten postas duplicadas en el itinerario"
    ),
  force: z.boolean().default(false),
});

export const resetProgressSchema = z.object({
  confirm: z.literal(true, {
    errorMap: () => ({ message: "Se requiere confirmacion explicita" }),
  }),
});