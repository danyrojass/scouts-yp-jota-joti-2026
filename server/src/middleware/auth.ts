import type { RequestHandler } from "express";
import { ApiError } from "@/utils/errors";
import { parseSession } from "@/utils/asyncHandler";

type Principal = { type: "admin" | "team"; id: string };

export function getPrincipal(req: Parameters<RequestHandler>[0]): Principal | null {
  const session = parseSession(req);
  return session.principal ?? null;
}

export function requireAuth(req: Parameters<RequestHandler>[0]) {
  const principal = getPrincipal(req);
  if (!principal) throw ApiError.unauthorized("Debes iniciar sesion");
  return principal;
}

/** Any authenticated principal (admin or team). */
export function requireAnyAuth(): RequestHandler {
  return (req, _res, next) => {
    try {
      requireAuth(req);
      next();
    } catch (err) {
      next(err);
    }
  };
}

export function requireAdmin(): RequestHandler {
  return (req, _res, next) => {
    try {
      const principal = requireAuth(req);
      if (principal.type !== "admin") {
        throw ApiError.forbidden("Acceso reservado a administradores");
      }
      next();
    } catch (err) {
      next(err);
    }
  };
}

export function requireTeam(): RequestHandler {
  return (req, _res, next) => {
    try {
      const principal = requireAuth(req);
      if (principal.type !== "team") {
        throw ApiError.forbidden("Acceso reservado a equipos");
      }
      next();
    } catch (err) {
      next(err);
    }
  };
}