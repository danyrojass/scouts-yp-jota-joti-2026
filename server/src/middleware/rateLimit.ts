import rateLimit from "express-rate-limit";
import { env } from "@/config/env";

/** Limits failed login attempts from the same IP. */
export const loginRateLimiter = rateLimit({
  windowMs: env.LOGIN_WINDOW_MINUTES * 60 * 1000,
  limit: env.LOGIN_MAX_ATTEMPTS,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  message: {
    error: {
      code: "TOO_MANY_REQUESTS",
      message: "Demasiados intentos fallidos. Intenta de nuevo mas tarde.",
    },
  },
});

/** General API firewall to protect against abuse. */
export const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: { code: "TOO_MANY_REQUESTS", message: "Demasiadas solicitudes" },
  },
});