import { Router } from "express";
import { asyncHandler } from "@/utils/asyncHandler";
import { requireAdmin, getPrincipal } from "@/middleware/auth";
import { csrfProtection } from "@/middleware/csrf";
import { audit } from "@/utils/audit";
import {
  createMemberSchema,
  updateMemberSchema,
} from "@/modules/members/member.validators";
import * as memberService from "@/modules/members/member.service";

export const memberRoutes = Router();

memberRoutes.use(requireAdmin());

memberRoutes.get("/", asyncHandler(async (req, res) => {
  const eventId = String(req.query.eventId ?? "");
  const members = await memberService.listMembers(eventId);
  res.json({ members });
}));

memberRoutes.post("/", csrfProtection, asyncHandler(async (req, res) => {
  const data = createMemberSchema.parse(req.body);
  const member = await memberService.createMember(data);
  await audit(
    "CREATE",
    "Member",
    member.id,
    { type: "admin", id: getPrincipal(req)!.id },
    { firstName: member.firstName, lastName: member.lastName, teamId: member.teamId },
    { eventId: member.eventId, teamId: member.teamId ?? undefined }
  );
  res.status(201).json({ member });
}));

memberRoutes.patch("/:id", csrfProtection, asyncHandler(async (req, res) => {
  const data = updateMemberSchema.parse(req.body);
  const member = await memberService.updateMember(req.params.id, data);
  await audit(
    "UPDATE",
    "Member",
    member.id,
    { type: "admin", id: getPrincipal(req)!.id },
    data as Record<string, unknown>,
    { eventId: member.eventId, teamId: member.teamId ?? undefined }
  );
  res.json({ member });
}));

memberRoutes.delete("/:id", csrfProtection, asyncHandler(async (req, res) => {
  const member = await memberService.deleteMember(req.params.id);
  await audit(
    "DELETE",
    "Member",
    req.params.id,
    { type: "admin", id: getPrincipal(req)!.id },
    { firstName: member.firstName, lastName: member.lastName },
    { eventId: member.eventId }
  );
  res.status(204).end();
}));
