import { z } from "zod";

export const registerVisitSchema = z.object({
  publicToken: z.string().min(8, "Token invalido").max(64),
  answer: z.string().trim().max(500).optional().default(""),
});

export const skipStationSchema = z.object({
  // Frase de rescate que dictan los coordinadores para habilitar el salto.
  phrase: z.string().trim().min(1, "Ingresa la frase de rescate").max(200),
  reason: z.string().trim().max(300).optional().default(""),
});