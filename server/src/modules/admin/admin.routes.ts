import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "@/utils/asyncHandler";
import { requireAdmin } from "@/middleware/auth";
import {
  buildResultsCsv,
  getDashboard,
} from "@/modules/admin/admin.service";
import { prisma } from "@/lib/prisma";

export const adminRoutes = Router();

adminRoutes.use(requireAdmin());

adminRoutes.get("/dashboard", asyncHandler(async (req, res) => {
  const eventId = z.string().min(1).parse(req.query.eventId);
  const dashboard = await getDashboard(eventId);
  res.json(dashboard);
}));

adminRoutes.get("/results", asyncHandler(async (req, res) => {
  const eventId = z.string().min(1).parse(req.query.eventId);
  const csv = await buildResultsCsv(eventId);
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader(
    "Content-Disposition",
    "attachment; filename=\"resultados.csv\""
  );
  res.send(`\uFEFF${csv}`);
}));

adminRoutes.get("/audit-logs", asyncHandler(async (req, res) => {
  const eventId = z.string().min(1).optional().parse(req.query.eventId);
  const logs = await prisma.auditLog.findMany({
    where: eventId ? { eventId } : {},
    orderBy: { createdAt: "desc" },
    take: 100,
    include: { user: { select: { username: true } }, team: { select: { name: true } } },
  });
  res.json({
    logs: logs.map((l) => ({ ...l, details: l.details ? JSON.parse(l.details) : null })),
  });
}));