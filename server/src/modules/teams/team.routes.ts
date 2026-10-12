import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "@/utils/asyncHandler";
import { requireAdmin, getPrincipal } from "@/middleware/auth";
import { csrfProtection } from "@/middleware/csrf";
import { ApiError } from "@/utils/errors";
import {
  createTeamSchema,
  resetProgressSchema,
  setRouteSchema,
  updateTeamSchema,
} from "@/modules/teams/team.validators";
import * as teamService from "@/modules/teams/team.service";
import {
  computeProgress,
  getTeamWithRuntime,
} from "@/modules/progress/progress.service";
import { audit } from "@/utils/audit";

export const teamRoutes = Router();

teamRoutes.use(requireAdmin());

teamRoutes.post("/", csrfProtection, asyncHandler(async (req, res) => {
  const body = createTeamSchema.extend({ eventId: z.string().min(1) }).parse(req.body);
  const team = await teamService.createTeam(body.eventId, body);
  await audit(
    "CREATE",
    "Team",
    team.id,
    { type: "admin", id: getPrincipal(req)!.id },
    { name: team.name, username: team.username },
    { eventId: team.eventId, teamId: team.id }
  );
  res.status(201).json({ team });
}));

teamRoutes.get("/:id", asyncHandler(async (req, res) => {
  const team = await getTeamWithRuntime(req.params.id);
  if (!team) throw ApiError.notFound("Equipo no encontrado");
  const progress = computeProgress(team);
  const { passwordHash: _ph, ...safe } = team;
  res.json({ team: { ...safe, progress } });
}));

teamRoutes.patch("/:id", csrfProtection, asyncHandler(async (req, res) => {
  const data = updateTeamSchema.parse(req.body);
  const team = await teamService.updateTeam(req.params.id, data);
  await audit(
    "UPDATE",
    "Team",
    team.id,
    { type: "admin", id: getPrincipal(req)!.id },
    { changes: { name: data.name, active: data.active, passwordChanged: !!data.password } },
    { eventId: team.eventId, teamId: team.id }
  );
  res.json({ team });
}));

teamRoutes.get("/:id/route", asyncHandler(async (req, res) => {
  const team = await getTeamWithRuntime(req.params.id);
  if (!team) throw ApiError.notFound("Equipo no encontrado");
  const stops = [...team.routeStops]
    .sort((a, b) => a.position - b.position)
    .map((s) => ({
      position: s.position,
      station: {
        id: s.station.id,
        name: s.station.name,
        description: s.station.description,
        challengeType: s.station.challengeType,
      },
    }));
  res.json({ route: stops, teamName: team.name, eventName: team.event.name });
}));

teamRoutes.put("/:id/route", csrfProtection, asyncHandler(async (req, res) => {
  const { stationIds, force } = setRouteSchema.parse(req.body);
  const admin = getPrincipal(req)!;
  const result = await teamService.setTeamRoute(
    req.params.id,
    stationIds,
    force,
    "admin",
    admin.id
  );
  res.json({ ok: true, count: result.count });
}));

teamRoutes.post("/:id/reset-progress", csrfProtection, asyncHandler(async (req, res) => {
  resetProgressSchema.parse(req.body);
  const admin = getPrincipal(req)!;
  const result = await teamService.resetTeamProgress(req.params.id, "admin", admin.id);
  await audit(
    "RESET_PROGRESS",
    "Team",
    req.params.id,
    { type: "admin", id: admin.id },
    { deletedVisits: result.deletedVisits },
    { teamId: req.params.id }
  );
  res.json({ ok: true, deletedVisits: result.deletedVisits });
}));