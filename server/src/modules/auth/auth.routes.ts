import { Router } from "express";
import { asyncHandler, parseSession } from "@/utils/asyncHandler";
import { loginRateLimiter } from "@/middleware/rateLimit";
import { csrfProtection, issueCsrf } from "@/middleware/csrf";
import { loginSchema } from "@/modules/auth/auth.validators";
import {
  destroySession,
  login,
  me,
  startSession,
} from "@/modules/auth/auth.service";
import { getPrincipal, requireAnyAuth } from "@/middleware/auth";

export const authRoutes = Router();

authRoutes.get("/csrf", issueCsrf);

authRoutes.post("/login", loginRateLimiter, asyncHandler(async (req, res) => {
  const { username, password } = loginSchema.parse(req.body);
  const info = await login(username, password);
  const principal =
    info.type === "admin" ? { type: "admin" as const, id: info.user.id } : { type: "team" as const, id: info.team.id };
  await startSession(req, principal);
  res.json({ principal: info, csrfToken: parseSession(req).csrfToken ?? null });
}));

authRoutes.post("/logout", csrfProtection, asyncHandler(async (req, res) => {
  await destroySession(req);
  res.json({ ok: true });
}));

authRoutes.get("/me", requireAnyAuth(), asyncHandler(async (req, res) => {
  const principal = getPrincipal(req)!;
  res.json({ principal: await me(principal) });
}));