import { z } from "zod";

export const challengeTypeSchema = z.enum([ "CODE", "QUESTION", "CONFIRMATION", "AUTO" ]);

const latitudeSchema = z
  .number()
  .min(-90, "La latitud debe estar entre -90 y 90")
  .max(90, "La latitud debe estar entre -90 y 90")
  .nullable();

const longitudeSchema = z
  .number()
  .min(-180, "La longitud debe estar entre -180 y 180")
  .max(180, "La longitud debe estar entre -180 y 180")
  .nullable();

export const createStationSchema = z.object({
  eventId: z.string().min(1),
  name: z.string().trim().min(2, "El nombre es obligatorio").max(120),
  description: z.string().trim().max(2000).optional().nullable(),
  challengeType: challengeTypeSchema,
  instructions: z.string().trim().max(2000).optional().nullable(),
  displayedCode: z.string().trim().max(200).optional().nullable(),
  expectedAnswer: z.string().trim().max(500).optional().nullable(),
  // Frase que habilita saltar esta posta si el QR no se puede escanear.
  rescuePhrase: z.string().trim().max(200).optional().nullable(),
  autoAcceptAny: z.boolean().default(false),
  active: z.boolean().default(true),
  latitude: latitudeSchema.optional(),
  longitude: longitudeSchema.optional(),
});

export const updateStationSchema = createStationSchema.partial().omit({ eventId: true });

export const importStationsSchema = z.object({
  eventId: z.string().min(1),
  csv: z.string().min(1, "El CSV est\u00e1 vac\u00edo"),
});
