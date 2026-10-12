import { z } from "zod";

export const SAFARI_CATEGORIES = [
  "LUGARES_CULTURA",
  "NATURALEZA",
  "OBJETOS_CURIOSIDADES",
  "DESAFIOS_FOTOGRAFICOS",
  "GENERAL",
] as const;

export const SAFARI_ITEM_TYPES = [
  "PHOTO",
  "OBJECT",
  "NUMERIC",
  "COLLECTION",
] as const;

export const safariCategorySchema = z.enum(SAFARI_CATEGORIES);
export const safariItemTypeSchema = z.enum(SAFARI_ITEM_TYPES);

export const createSafariSchema = z.object({
  eventId: z.string().min(1),
  title: z.string().trim().min(2).max(120).optional(),
  description: z.string().trim().max(2000).optional().nullable(),
});

export const updateSafariSchema = z.object({
  title: z.string().trim().min(2).max(120).optional(),
  description: z.string().trim().max(2000).optional().nullable(),
  active: z.boolean().optional(),
});

export const createSafariItemSchema = z.object({
  name: z.string().trim().min(2, "El nombre es obligatorio").max(160),
  description: z.string().trim().max(1000).optional().nullable(),
  position: z.number().int().min(0).optional(),
  active: z.boolean().optional(),
  category: safariCategorySchema.optional(),
  itemType: safariItemTypeSchema.optional(),
  requiresPhoto: z.boolean().optional(),
});

export const updateSafariItemSchema = createSafariItemSchema.partial();

export const reorderSafariItemsSchema = z.object({
  itemIds: z.array(z.string().min(1)).min(1, "La lista de elementos no puede estar vacia"),
});

export const resetSafariProgressSchema = z.object({
  eventId: z.string().min(1),
  teamId: z.string().min(1).optional(),
});

export const findSafariItemSchema = z.object({
  value: z.string().trim().max(500).optional().nullable(),
});

export const safariPhotoReadySchema = z.object({
  ready: z.boolean(),
});
