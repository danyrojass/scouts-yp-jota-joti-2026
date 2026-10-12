import { randomBytes } from "node:crypto";
import type { RequestHandler } from "express";
import { ApiError } from "@/utils/errors";
import { parseSession } from "@/utils/asyncHandler";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/** Returns the CSRF token for the current session, generating it if missing. */
export function ensureCsrfToken(req: Parameters<RequestHandler>[0]) {
  const session = parseSession(req);
  if (!session.csrfToken) {
    session.csrfToken = randomBytes(24).toString("hex");
  }
  return session.csrfToken;
}

/** Issues the CSRF token (GET /api/v1/auth/csrf). */
export const issueCsrf: RequestHandler = (req, res) => {
  const token = ensureCsrfToken(req);
  res.json({ csrfToken: token });
};

/**
 * Validates the x-csrf-token header against the token stored in the session
 * for every non-safe method. The client obtains the token from
 * GET /api/v1/auth/csrf after login.
 */
export const csrfProtection: RequestHandler = (req, res, next) => {
  if (SAFE_METHODS.has(req.method)) return next();
  const session = parseSession(req);
  const expected = session.csrfToken;
  const provided = req.headers["x-csrf-token"];
  if (!expected || typeof provided !== "string" || provided !== expected) {
    return next(ApiError.forbidden("Token CSRF invalido"));
  }
  next();
};