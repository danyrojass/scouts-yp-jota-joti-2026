import express from "express";
import cors from "cors";
import helmet from "helmet";
import { env } from "@/config/env";
import { sessionMiddleware } from "@/lib/session";
import { apiLimiter } from "@/middleware/rateLimit";
import { errorHandler, notFoundHandler } from "@/utils/asyncHandler";
import { authRoutes } from "@/modules/auth/auth.routes";
import { eventRoutes } from "@/modules/events/event.routes";
import { teamRoutes } from "@/modules/teams/team.routes";
import { stationRoutes } from "@/modules/stations/station.routes";
import { passportRoutes } from "@/modules/passport/passport.routes";
import { visitRoutes } from "@/modules/visits/visit.routes";
import { safariRoutes } from "@/modules/safari/safari.routes";
import { safariAdminRoutes } from "@/modules/safari/safari-admin.routes";
import { adminRoutes } from "@/modules/admin/admin.routes";

/**
 * Origins allowed by CORS. Besides `CORS_ORIGINS`, the origin of the public
 * site (`PUBLIC_BASE_URL`) is always allowed: the SPA and the API share a
 * domain, so the browser sends an `Origin` header that must match. This avoids
 * a 500 "Origen no permitido por CORS" when only `PUBLIC_BASE_URL` is set.
 */
const allowedOrigins = new Set<string>(env.CORS_ORIGINS);
try {
  allowedOrigins.add(new URL(env.PUBLIC_BASE_URL).origin);
} catch {
  // PUBLIC_BASE_URL is already validated as a URL by zod; defensive only.
}

export function createApp() {
  const app = express();

  app.set("trust proxy", env.TRUST_PROXY);

  app.use(
    helmet({
      contentSecurityPolicy: env.NODE_ENV === "production" ? undefined : false,
      crossOriginResourcePolicy: { policy: "cross-origin" },
    })
  );

  app.use(
    cors({
      origin(origin, callback) {
        // Allow requests with no origin (curl, tests, server-to-server).
        if (!origin) return callback(null, true);
        if (allowedOrigins.has(origin)) return callback(null, true);
        return callback(new Error(`Origen no permitido por CORS: ${origin}`));
      },
      credentials: true,
      methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    })
  );

  app.use(express.json({ limit: "256kb" }));

  app.use(sessionMiddleware);

  app.use("/api/v1", apiLimiter);

  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok", ts: new Date().toISOString() });
  });

  app.use("/api/v1/auth", authRoutes);
  app.use("/api/v1/events", eventRoutes);
  app.use("/api/v1/teams", teamRoutes);
  app.use("/api/v1/stations", stationRoutes);
  app.use("/api/v1/passport", passportRoutes);
  app.use("/api/v1/visits", visitRoutes);
  app.use("/api/v1/safari", safariRoutes);
  app.use("/api/v1/admin/safari", safariAdminRoutes);
  app.use("/api/v1/admin", adminRoutes);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}