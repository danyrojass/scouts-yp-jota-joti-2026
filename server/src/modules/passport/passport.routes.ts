import { Router } from "express";
import { asyncHandler } from "@/utils/asyncHandler";
import { requireTeam } from "@/middleware/auth";
import { csrfProtection } from "@/middleware/csrf";
import { teamPassport } from "@/modules/visits/visit.service";
import { getPrincipal } from "@/middleware/auth";
import { updateProfileSchema } from "@/modules/teams/team.validators";
import { updateTeamName } from "@/modules/teams/team.service";

export const passportRoutes = Router();

passportRoutes.use(requireTeam());

/** Digital passport: itinerary, progress and history for the authenticated team. */
passportRoutes.get("/", asyncHandler(async (req, res) => {
  const teamId = getPrincipal(req)!.id;
  const passport = await teamPassport(teamId);
  res.json(passport);
}));

/** Rename the authenticated team (display name only; username is unchanged). */
passportRoutes.patch("/profile", csrfProtection, asyncHandler(async (req, res) => {
  const { name } = updateProfileSchema.parse(req.body);
  const team = await updateTeamName(getPrincipal(req)!.id, name);
  res.json({
    team: {
      id: team.id,
      name: team.name,
      username: team.username,
      eventId: team.eventId,
    },
  });
}));

/** Next station for the authenticated team. */
passportRoutes.get("/next-station", asyncHandler(async (req, res) => {
  const teamId = getPrincipal(req)!.id;
  const passport = await teamPassport(teamId);
  res.json({ nextStation: passport.progress.nextStationId });
}));