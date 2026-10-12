import { z } from "zod";

export const loginSchema = z.object({
  username: z
    .string()
    .trim()
    .min(2, "El usuario es demasiado corto")
    .max(64, "El usuario es demasiado largo"),
  password: z
    .string()
    .min(1, "La contrasena es obligatoria")
    .max(128, "La contrasena es demasiado larga"),
});