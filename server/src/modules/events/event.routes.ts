import { Router } from "express";
import { asyncHandler } from "@/utils/asyncHandler";
import { requireAdmin } from "@/middleware/auth";
import { csrfProtection } from "@/middleware/csrf";
import { createEventSchema, updateEventSchema } from "@/modules/events/event.validators";
import * as eventService from "@/modules/events/event.service";
import { audit } from "@/utils/audit";
import { getPrincipal } from "@/middleware/auth";

export const eventRoutes = Router();

eventRoutes.use(requireAdmin());

eventRoutes.get("/", asyncHandler(async (_req, res) => {
  res.json({ events: await eventService.listEvents() });
}));

eventRoutes.get("/:id", asyncHandler(async (req, res) => {
  const event = await eventService.getEventById(req.params.id, true);
  res.json({ event });
}));

eventRoutes.post("/", csrfProtection, asyncHandler(async (req, res) => {
  const data = createEventSchema.parse(req.body);
  const event = await eventService.createEvent(data);
  await audit("CREATE", "Event", event.id, { type: "admin", id: getPrincipal(req)!.id }, { name: event.name }, { eventId: event.id });
  res.status(201).json({ event });
}));

eventRoutes.patch("/:id", csrfProtection, asyncHandler(async (req, res) => {
  const data = updateEventSchema.parse(req.body);
  const event = await eventService.updateEvent(req.params.id, data);
  await audit("UPDATE", "Event", event.id, { type: "admin", id: getPrincipal(req)!.id }, { changes: data }, { eventId: event.id });
  res.json({ event });
}));

eventRoutes.post("/:id/start", csrfProtection, asyncHandler(async (req, res) => {
  const event = await eventService.transitionEvent(req.params.id, "IN_PROGRESS");
  await audit("START", "Event", event.id, { type: "admin", id: getPrincipal(req)!.id }, {}, { eventId: event.id });
  res.json({ event });
}));

eventRoutes.post("/:id/finish", csrfProtection, asyncHandler(async (req, res) => {
  const event = await eventService.transitionEvent(req.params.id, "FINISHED");
  await audit("FINISH", "Event", event.id, { type: "admin", id: getPrincipal(req)!.id }, {}, { eventId: event.id });
  res.json({ event });
}));

eventRoutes.post("/:id/cancel", csrfProtection, asyncHandler(async (req, res) => {
  const event = await eventService.transitionEvent(req.params.id, "CANCELLED");
  await audit("CANCEL", "Event", event.id, { type: "admin", id: getPrincipal(req)!.id }, {}, { eventId: event.id });
  res.json({ event });
}));

eventRoutes.delete("/:id", csrfProtection, asyncHandler(async (req, res) => {
  await eventService.deleteEvent(req.params.id);
  await audit("DELETE", "Event", req.params.id, { type: "admin", id: getPrincipal(req)!.id });
  res.status(204).end();
}));