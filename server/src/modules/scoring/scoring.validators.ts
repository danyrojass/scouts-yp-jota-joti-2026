import { z } from "zod";

export const ACTIVITY_STATUSES = ["PENDING", "IN_EVALUATION", "FINISHED"] as const;
export const SCORING_METHODS = ["MANUAL", "CHECKLIST", "STATIONS"] as const;

export const activityStatusSchema = z.enum(ACTIVITY_STATUSES);
export const scoringMethodSchema = z.enum(SCORING_METHODS);

export const createActivitySchema = z.object({
  eventId: z.string().min(1),
  name: z.string().trim().min(2, "El nombre es obligatorio").max(120),
  description: z.string().trim().max(2000).optional().nullable(),
  maxScore: z.number().finite().min(0).nullable().optional(),
  position: z.number().int().min(0).optional(),
  status: activityStatusSchema.optional(),
  scoringMethod: scoringMethodSchema.optional(),
  published: z.boolean().optional(),
  allowMaxScoreExceeded: z.boolean().optional(),
  active: z.boolean().optional(),
});

export const updateActivitySchema = createActivitySchema
  .omit({ eventId: true })
  .partial();

export const reorderActivitiesSchema = z.object({
  eventId: z.string().min(1),
  activityIds: z
    .array(z.string().min(1))
    .min(1, "La lista de actividades no puede estar vacia"),
});

export const upsertScoreSchema = z.object({
  eventId: z.string().min(1),
  teamId: z.string().min(1),
  activityId: z.string().min(1),
  evaluated: z.boolean(),
  // El tope contra maxScore se valida en el servicio (depende de la actividad).
  score: z.number().finite().min(0, "El puntaje no puede ser negativo").nullable().optional(),
  observations: z.string().trim().max(2000).nullable().optional(),
});

export const publishRankingSchema = z.object({
  eventId: z.string().min(1),
  published: z.boolean(),
});
