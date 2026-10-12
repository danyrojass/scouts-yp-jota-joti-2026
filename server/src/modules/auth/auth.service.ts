import bcrypt from "bcryptjs";
import type { Request } from "express";
import { prisma } from "@/lib/prisma";
import { ApiError } from "@/utils/errors";
import { parseSession } from "@/utils/asyncHandler";

const SALT_ROUNDS = 12;

export function hashPassword(plain: string) {
  return bcrypt.hash(plain, SALT_ROUNDS);
}

export function verifyPassword(plain: string, hash: string) {
  return bcrypt.compare(plain, hash);
}

export type PublicUser = {
  id: string;
  username: string;
  role: "ADMIN";
};

export type PublicTeam = {
  id: string;
  name: string;
  username: string;
  eventId: string;
};

export type PrincipalInfo =
  | { type: "admin"; user: PublicUser }
  | { type: "team"; team: PublicTeam; eventName: string };

async function findAdmin(username: string) {
  return prisma.user.findUnique({ where: { username } });
}

async function findTeamByUsername(username: string) {
  return prisma.team.findUnique({
    where: { username },
    include: { event: { select: { name: true } } },
  });
}

/**
 * Authenticates a username/password pair. Supports both administrative users
 * and teams. Never reveals whether the username existed or just the password
 * was wrong.
 */
export async function login(
  username: string,
  password: string
): Promise<PrincipalInfo> {
  const [admin, team] = await Promise.all([
    findAdmin(username),
    findTeamByUsername(username),
  ]);

  if (admin && admin.active) {
    const ok = await verifyPassword(password, admin.passwordHash);
    if (!ok) throw ApiError.unauthorized("Usuario o contrasena incorrectos");
    return {
      type: "admin",
      user: { id: admin.id, username: admin.username, role: admin.role },
    };
  }

  if (team && team.active) {
    const ok = await verifyPassword(password, team.passwordHash);
    if (!ok) throw ApiError.unauthorized("Usuario o contrasena incorrectos");
    return {
      type: "team",
      team: {
        id: team.id,
        name: team.name,
        username: team.username,
        eventId: team.eventId,
      },
      eventName: team.event.name,
    };
  }

  // Same error for nonexistent or inactive accounts.
  throw ApiError.unauthorized("Usuario o contrasena incorrectos");
}

/** Starts an authenticated session, rotating the session id (fixation-safe). */
export function startSession(
  req: Request,
  principal: { type: "admin" | "team"; id: string }
): Promise<void> {
  return new Promise((resolve, reject) => {
    const session = parseSession(req);
    session.regenerate((err) => {
      if (err) return reject(err);
      const newSession = parseSession(req);
      newSession.principal = principal;
      newSession.save((saveErr) => {
        if (saveErr) return reject(saveErr);
        resolve();
      });
    });
  });
}

export function destroySession(req: Request): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!req.session) return resolve();
    req.session.destroy((err) => (err ? reject(err) : resolve()));
  });
}

export async function me(principal: { type: "admin" | "team"; id: string }): Promise<PrincipalInfo> {
  if (principal.type === "admin") {
    const user = await prisma.user.findUnique({ where: { id: principal.id } });
    if (!user) throw ApiError.unauthorized("Sesion invalida");
    return { type: "admin", user: { id: user.id, username: user.username, role: user.role } };
  }

  const team = await prisma.team.findUnique({
    where: { id: principal.id },
    include: { event: { select: { name: true } } },
  });
  if (!team) throw ApiError.unauthorized("Sesion invalida");
  return {
    type: "team",
    team: {
      id: team.id,
      name: team.name,
      username: team.username,
      eventId: team.eventId,
    },
    eventName: team.event.name,
  };
}