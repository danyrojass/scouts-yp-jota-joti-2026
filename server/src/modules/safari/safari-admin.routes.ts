import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "@/utils/asyncHandler";
import { requireAdmin, getPrincipal } from "@/middleware/auth";
import { csrfProtection } from "@/middleware/csrf";
import { audit } from "@/utils/audit";
import {
  createSafariSchema,
  createSafariItemSchema,
  reorderSafariItemsSchema,
  resetSafariProgressSchema,
  updateSafariItemSchema,
  updateSafariSchema,
} from "@/modules/safari/safari.validators";
import * as safariService from "@/modules/safari/safari.service";

export const safariAdminRoutes = Router();

safariAdminRoutes.use(requireAdmin());

safariAdminRoutes.get("/", asyncHandler(async (req, res) => {
  const eventId = z.string().min(1).parse(req.query.eventId);
  res.json(await safariService.getAdminSafari(eventId));
}));

safariAdminRoutes.post("/", csrfProtection, asyncHandler(async (req, res) => {
  const data = createSafariSchema.parse(req.body);
  const safari = await safariService.createSafari(data.eventId, data);
  await audit(
    "CREATE",
    "Safari",
    safari.id,
    { type: "admin", id: getPrincipal(req)!.id },
    { title: safari.title },
    { eventId: safari.eventId }
  );
  res.status(201).json({ safari });
}));

safariAdminRoutes.patch("/:id", csrfProtection, asyncHandler(async (req, res) => {
  const data = updateSafariSchema.parse(req.body);
  const safari = await safariService.updateSafari(req.params.id, data);
  await audit(
    "UPDATE",
    "Safari",
    safari.id,
    { type: "admin", id: getPrincipal(req)!.id },
    { changes: data },
    { eventId: safari.eventId }
  );
  res.json({ safari });
}));

safariAdminRoutes.get("/:id/progress", asyncHandler(async (req, res) => {
  res.json(await safariService.getSafariProgress(req.params.id));
}));

safariAdminRoutes.post("/reset", csrfProtection, asyncHandler(async (req, res) => {
  const { eventId, teamId } = resetSafariProgressSchema.parse(req.body);
  const result = await safariService.resetSafariProgress(eventId, teamId);
  await audit(
    "SAFARI_PROGRESS_RESET",
    "SafariFind",
    result.safariId,
    { type: "admin", id: getPrincipal(req)!.id },
    { deleted: result.deleted, teamId: teamId ?? null },
    { eventId, teamId }
  );
  res.json({ deleted: result.deleted });
}));

safariAdminRoutes.post("/:id/items", csrfProtection, asyncHandler(async (req, res) => {
  const data = createSafariItemSchema.parse(req.body);
  const item = await safariService.createSafariItem(req.params.id, data);
  await audit(
    "CREATE",
    "SafariItem",
    item.id,
    { type: "admin", id: getPrincipal(req)!.id },
    { name: item.name }
  );
  res.status(201).json({ item });
}));

safariAdminRoutes.patch("/items/:itemId", csrfProtection, asyncHandler(async (req, res) => {
  const data = updateSafariItemSchema.parse(req.body);
  const item = await safariService.updateSafariItem(req.params.itemId, data);
  await audit(
    "UPDATE",
    "SafariItem",
    item.id,
    { type: "admin", id: getPrincipal(req)!.id },
    { changes: data }
  );
  res.json({ item });
}));

safariAdminRoutes.delete("/items/:itemId", csrfProtection, asyncHandler(async (req, res) => {
  await safariService.deleteSafariItem(req.params.itemId);
  await audit("DELETE", "SafariItem", req.params.itemId, {
    type: "admin",
    id: getPrincipal(req)!.id,
  });
  res.status(204).end();
}));

safariAdminRoutes.post("/:id/reorder", csrfProtection, asyncHandler(async (req, res) => {
  const { itemIds } = reorderSafariItemsSchema.parse(req.body);
  await safariService.reorderSafariItems(req.params.id, itemIds);
  await audit(
    "REORDER",
    "SafariItem",
    req.params.id,
    { type: "admin", id: getPrincipal(req)!.id },
    { order: itemIds }
  );
  res.json(await safariService.getSafariWithItems(req.params.id));
}));
