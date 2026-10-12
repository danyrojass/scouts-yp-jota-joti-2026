import { Router } from "express";
import { asyncHandler } from "@/utils/asyncHandler";
import { requireTeam, getPrincipal } from "@/middleware/auth";
import { csrfProtection } from "@/middleware/csrf";
import {
  findSafariItemSchema,
  safariPhotoReadySchema,
} from "@/modules/safari/safari.validators";
import {
  getTeamSafari,
  setSafariItemFound,
  setSafariPhotoReady,
} from "@/modules/safari/safari.service";

export const safariRoutes = Router();

safariRoutes.use(requireTeam());

/** Safari checklist of the authenticated team. */
safariRoutes.get("/", asyncHandler(async (req, res) => {
  const teamId = getPrincipal(req)!.id;
  res.json(await getTeamSafari(teamId));
}));

/** Marks an item as found by the team (with an optional observation value). */
safariRoutes.post("/items/:itemId/find", csrfProtection, asyncHandler(async (req, res) => {
  const teamId = getPrincipal(req)!.id;
  const { value } = findSafariItemSchema.parse(req.body ?? {});
  res.json(await setSafariItemFound(teamId, req.params.itemId, true, value));
}));

/** Unmarks an item previously found by the team. */
safariRoutes.delete("/items/:itemId/find", csrfProtection, asyncHandler(async (req, res) => {
  const teamId = getPrincipal(req)!.id;
  res.json(await setSafariItemFound(teamId, req.params.itemId, false));
}));

/** Registers that the photographic evidence is ready / shared per the rules. */
safariRoutes.post("/items/:itemId/photo", csrfProtection, asyncHandler(async (req, res) => {
  const teamId = getPrincipal(req)!.id;
  const { ready } = safariPhotoReadySchema.parse(req.body);
  res.json(await setSafariPhotoReady(teamId, req.params.itemId, ready));
}));
