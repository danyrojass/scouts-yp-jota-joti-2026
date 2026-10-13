import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "@/utils/asyncHandler";
import * as scoring from "@/modules/scoring/scoring.service";

// Ranking publico: no requiere sesion. Solo expone resultados si el evento esta
// publicado (`rankingPublished`), y nunca observaciones ni datos de auditoria.
export const rankingRoutes = Router();

rankingRoutes.get("/", asyncHandler(async (req, res) => {
  const eventId = z.string().min(1).optional().parse(req.query.eventId);
  res.json(await scoring.getPublicRanking(eventId));
}));

rankingRoutes.get("/:eventId", asyncHandler(async (req, res) => {
  res.json(await scoring.getPublicRanking(req.params.eventId));
}));

rankingRoutes.get("/:eventId/teams/:teamId", asyncHandler(async (req, res) => {
  res.json(await scoring.getPublicTeamDetail(req.params.eventId, req.params.teamId));
}));
