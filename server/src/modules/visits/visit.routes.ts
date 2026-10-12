import { Router } from "express";
import { asyncHandler } from "@/utils/asyncHandler";
import { requireTeam } from "@/middleware/auth";
import { csrfProtection } from "@/middleware/csrf";
import { registerVisitSchema } from "@/modules/visits/visit.validators";
import {
  registerVisit,
  resolveStationChallenge,
} from "@/modules/visits/visit.service";
import { getPrincipal } from "@/middleware/auth";

export const visitRoutes = Router();

visitRoutes.use(requireTeam());

/** Public challenge screen data for a scanned station (must be authenticated). */
visitRoutes.get("/posta/:token", asyncHandler(async (req, res) => {
  const teamId = getPrincipal(req)!.id;
  const challenge = await resolveStationChallenge(req.params.token, teamId);
  res.json(challenge);
}));

/** Registers the visit + answer with server-side validation. */
visitRoutes.post("/", csrfProtection, asyncHandler(async (req, res) => {
  const { publicToken, answer } = registerVisitSchema.parse(req.body);
  const teamId = getPrincipal(req)!.id;
  const result = await registerVisit(publicToken, answer, teamId);
  res.json(result);
}));