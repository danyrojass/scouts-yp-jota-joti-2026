import { Router } from "express";
import { asyncHandler } from "@/utils/asyncHandler";
import { requireTeam, getPrincipal } from "@/middleware/auth";
import { csrfProtection } from "@/middleware/csrf";
import { getTeamSafari, setSafariItemFound } from "@/modules/safari/safari.service";

export const safariRoutes = Router();

safariRoutes.use(requireTeam());

/** Safari checklist of the authenticated team. */
safariRoutes.get("/", asyncHandler(async (req, res) => {
  const teamId = getPrincipal(req)!.id;
  res.json(await getTeamSafari(teamId));
}));

/** Marks an item as found by the team. */
safariRoutes.post("/items/:itemId/find", csrfProtection, asyncHandler(async (req, res) => {
  const teamId = getPrincipal(req)!.id;
  res.json(await setSafariItemFound(teamId, req.params.itemId, true));
}));

/** Unmarks an item previously found by the team. */
safariRoutes.delete("/items/:itemId/find", csrfProtection, asyncHandler(async (req, res) => {
  const teamId = getPrincipal(req)!.id;
  res.json(await setSafariItemFound(teamId, req.params.itemId, false));
}));
