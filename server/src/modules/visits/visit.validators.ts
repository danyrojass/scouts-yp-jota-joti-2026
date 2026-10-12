import { z } from "zod";

export const registerVisitSchema = z.object({
  publicToken: z.string().min(8, "Token invalido").max(64),
  answer: z.string().trim().max(500).optional().default(""),
});