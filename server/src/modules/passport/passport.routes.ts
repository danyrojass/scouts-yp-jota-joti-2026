import { Router } from "express";
import { asyncHandler } from "@/utils/asyncHandler";
import { requireTeam } from "@/middleware/auth";
import { teamPassport } from "@/modules/visits/visit.service";
import { getPrincipal } from "@/middleware/auth";

export const passportRoutes = Router();

passportRoutes.use(requireTeam());

/** Digital passport: itinerary, progress and history for the authenticated team. */
passportRoutes.get("/", asyncHandler(async (req, res) => {
  const teamId = getPrincipal(req)!.id;
  const passport = await teamPassport(teamId);
  res.json(passport);
}));

/** Next station for the authenticated team. */
passportRoutes.get("/next-station", asyncHandler(async (req, res) => {
  const teamId = getPrincipal(req)!.id;
  const passport = await teamPassport(teamId);
  res.json({ nextStation: passport.progress.nextStationId });
}));