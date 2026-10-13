import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "@/utils/asyncHandler";
import { requireAdmin, getPrincipal } from "@/middleware/auth";
import { csrfProtection } from "@/middleware/csrf";
import { audit } from "@/utils/audit";
import * as scoring from "@/modules/scoring/scoring.service";
import {
  createActivitySchema,
  publishRankingSchema,
  reorderActivitiesSchema,
  updateActivitySchema,
  upsertScoreSchema,
} from "@/modules/scoring/scoring.validators";

export const scoringAdminRoutes = Router();

scoringAdminRoutes.use(requireAdmin());

const actor = (req: Parameters<typeof getPrincipal>[0]) => getPrincipal(req)!.id;

// --- Actividades -----------------------------------------------------------

scoringAdminRoutes.get("/activities", asyncHandler(async (req, res) => {
  const eventId = z.string().min(1).parse(req.query.eventId);
  res.json({ activities: await scoring.listActivities(eventId) });
}));

scoringAdminRoutes.post("/activities", csrfProtection, asyncHandler(async (req, res) => {
  const data = createActivitySchema.parse(req.body);
  const activity = await scoring.createActivity(data.eventId, data);
  await audit(
    "CREATE",
    "Activity",
    activity.id,
    { type: "admin", id: actor(req) },
    { name: activity.name, scoringMethod: activity.scoringMethod },
    { eventId: activity.eventId }
  );
  res.status(201).json({ activity });
}));

scoringAdminRoutes.patch("/activities/reorder", csrfProtection, asyncHandler(async (req, res) => {
  const { eventId, activityIds } = reorderActivitiesSchema.parse(req.body);
  await scoring.reorderActivities(eventId, activityIds);
  await audit(
    "REORDER",
    "Activity",
    eventId,
    { type: "admin", id: actor(req) },
    { order: activityIds },
    { eventId }
  );
  res.json({ activities: await scoring.listActivities(eventId) });
}));

scoringAdminRoutes.patch("/activities/:id", csrfProtection, asyncHandler(async (req, res) => {
  const data = updateActivitySchema.parse(req.body);
  const activity = await scoring.updateActivity(req.params.id, data);
  await audit(
    "UPDATE",
    "Activity",
    activity.id,
    { type: "admin", id: actor(req) },
    { changes: data },
    { eventId: activity.eventId }
  );
  res.json({ activity });
}));

scoringAdminRoutes.delete("/activities/:id", csrfProtection, asyncHandler(async (req, res) => {
  const activity = await scoring.deleteActivity(req.params.id);
  await audit(
    "DELETE",
    "Activity",
    activity.id,
    { type: "admin", id: actor(req) },
    { name: activity.name },
    { eventId: activity.eventId }
  );
  res.status(204).end();
}));

// --- Puntajes --------------------------------------------------------------

scoringAdminRoutes.get("/scores", asyncHandler(async (req, res) => {
  const eventId = z.string().min(1).parse(req.query.eventId);
  res.json(await scoring.getScoreMatrix(eventId));
}));

scoringAdminRoutes.put("/scores", csrfProtection, asyncHandler(async (req, res) => {
  const data = upsertScoreSchema.parse(req.body);
  const result = await scoring.upsertScore(data, actor(req));
  await audit(
    result.created ? "CREATE" : "UPDATE",
    "TeamActivityScore",
    result.score.id,
    { type: "admin", id: actor(req) },
    {
      teamId: data.teamId,
      activityId: data.activityId,
      evaluated: data.evaluated,
      score: result.score.score,
    },
    { eventId: data.eventId, teamId: data.teamId }
  );
  res.json({ score: result.score, created: result.created });
}));

scoringAdminRoutes.delete("/scores/:id", csrfProtection, asyncHandler(async (req, res) => {
  const deleted = await scoring.deleteScore(req.params.id);
  await audit(
    "DELETE",
    "TeamActivityScore",
    deleted.id,
    { type: "admin", id: actor(req) },
    { teamId: deleted.teamId, activityId: deleted.activityId },
    { eventId: deleted.eventId, teamId: deleted.teamId }
  );
  res.status(204).end();
}));

// --- Ranking / publicacion / export ---------------------------------------

scoringAdminRoutes.get("/ranking", asyncHandler(async (req, res) => {
  const eventId = z.string().min(1).parse(req.query.eventId);
  res.json(await scoring.computeRanking(eventId, { publicOnly: false }));
}));

scoringAdminRoutes.get("/teams/:teamId", asyncHandler(async (req, res) => {
  const eventId = z.string().min(1).parse(req.query.eventId);
  res.json(
    await scoring.getTeamDetail(eventId, req.params.teamId, {
      includeObservations: true,
      publicOnly: false,
    })
  );
}));

scoringAdminRoutes.post("/ranking/publish", csrfProtection, asyncHandler(async (req, res) => {
  const { eventId, published } = publishRankingSchema.parse(req.body);
  const event = await scoring.publishRanking(eventId, published);
  await audit(
    published ? "RANKING_PUBLISHED" : "RANKING_UNPUBLISHED",
    "Event",
    eventId,
    { type: "admin", id: actor(req) },
    {},
    { eventId }
  );
  res.json({
    event: {
      id: event.id,
      rankingPublished: event.rankingPublished,
      rankingPublishedAt: event.rankingPublishedAt
        ? event.rankingPublishedAt.toISOString()
        : null,
    },
  });
}));

scoringAdminRoutes.get("/export", asyncHandler(async (req, res) => {
  const eventId = z.string().min(1).parse(req.query.eventId);
  const csv = await scoring.buildScoringCsv(eventId);
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader(
    "Content-Disposition",
    "attachment; filename=\"ranking.csv\""
  );
  res.send(`\uFEFF${csv}`);
}));
