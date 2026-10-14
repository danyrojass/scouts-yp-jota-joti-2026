import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ApiError } from "@/utils/errors";
import { hashPassword } from "@/modules/auth/auth.service";
import { recomputeStationsScoreForTeam } from "@/modules/scoring/scoring.service";

const usernameTakenError = (username: string) =>
  ApiError.conflict(
    `El nombre de usuario "${username}" ya esta en uso. Elegi otro.`
  );

async function assertUsernameAvailable(username: string, excludeTeamId?: string) {
  const [team, user] = await Promise.all([
    prisma.team.findUnique({ where: { username } }),
    prisma.user.findUnique({ where: { username } }),
  ]);
  if (team && team.id !== excludeTeamId) throw usernameTakenError(username);
  if (user) throw usernameTakenError(username);
}

export async function listTeams(eventId: string) {
  return prisma.team.findMany({
    where: { eventId },
    orderBy: { name: "asc" },
    include: {
      routeStops: {
        orderBy: { position: "asc" },
        select: { id: true, position: true, stationId: true },
      },
      _count: { select: { visits: true } },
    },
  });
}

export async function createTeam(eventId: string, data: {
  name: string;
  username: string;
  password: string;
  active: boolean;
}) {
  const event = await prisma.event.findUnique({ where: { id: eventId } });
  if (!event) throw ApiError.notFound("Evento no encontrado");

  await assertUsernameAvailable(data.username);

  return prisma.team.create({
    data: {
      eventId,
      name: data.name,
      username: data.username,
      passwordHash: await hashPassword(data.password),
      active: data.active,
    },
  });
}

export async function getTeamById(id: string, includeRuntime = false) {
  const team = await prisma.team.findUnique({
    where: { id },
    include: includeRuntime
      ? {
          event: true,
          routeStops: {
            orderBy: { position: "asc" },
            include: { station: true },
          },
          visits: { orderBy: { visitedAt: "desc" } },
        }
      : { event: true, routeStops: { orderBy: { position: "asc" } } },
  });
  if (!team) throw ApiError.notFound("Equipo no encontrado");
  return team;
}

export async function updateTeam(id: string, data: {
  name?: string;
  password?: string;
  active?: boolean;
}) {
  const team = await prisma.team.findUnique({ where: { id } });
  if (!team) throw ApiError.notFound("Equipo no encontrado");

  return prisma.team.update({
    where: { id },
    data: {
      name: data.name,
      active: data.active,
      ...(data.password ? { passwordHash: await hashPassword(data.password) } : {}),
    },
  });
}

/**
 * Allows a team to rename itself. Only the display name changes; the username
 * (login) stays. Names must be unique within the event.
 */
export async function updateTeamName(teamId: string, name: string) {
  const team = await prisma.team.findUnique({ where: { id: teamId } });
  if (!team) throw ApiError.notFound("Equipo no encontrado");

  const trimmed = name.trim();
  if (trimmed === team.name) return team;

  const clash = await prisma.team.findFirst({
    where: { eventId: team.eventId, name: trimmed, NOT: { id: teamId } },
  });
  if (clash) {
    throw ApiError.conflict(
      `Ya existe un equipo llamado "${trimmed}" en este evento. Elegi otro nombre.`
    );
  }

  return prisma.team.update({ where: { id: teamId }, data: { name: trimmed } });
}

/**
 * Replaces the team itinerary with the given ordered station ids. During an
 * in-progress event ordinary edits are blocked unless `force` is true.
 */
export async function setTeamRoute(
  teamId: string,
  stationIds: string[],
  force: boolean,
  actorType: string,
  actorId?: string
) {
  const team = await prisma.team.findUnique({
    where: { id: teamId },
    include: { event: true },
  });
  if (!team) throw ApiError.notFound("Equipo no encontrado");

  if (team.event.status === "IN_PROGRESS" && !force) {
    throw ApiError.forbidden(
      "El evento esta en curso. Los itinerarios no pueden modificarse. Usa la confirmacion excepcional si es necesario."
    );
  }

  const stations = await prisma.station.findMany({
    where: { id: { in: stationIds } },
  });
  const found = new Set(stations.map((s) => s.id));
  for (const id of stationIds) {
    if (!found.has(id)) throw ApiError.badRequest(`La posta ${id} no existe`);
  }
  const foreign = stations.find((s) => s.eventId !== team.eventId);
  if (foreign) {
    throw ApiError.badRequest(
      `La posta "${foreign.name}" no pertenece al evento del equipo`
    );
  }

  const route = await prisma.$transaction(async (tx) => {
    await tx.routeStop.deleteMany({ where: { teamId } });
    return tx.routeStop.createMany({
      data: stationIds.map((stationId, index) => ({
        teamId,
        stationId,
        position: index + 1,
      })),
    });
  });

  const auditDetails: Record<string, unknown> = {
    order: stationIds,
    forced: force,
    eventStatus: team.event.status,
  };

  await prisma.auditLog.create({
    data: {
      action: force ? "ROUTE_EDIT_FORCED" : "ROUTE_SET",
      entity: "RouteStop",
      entityId: team.id,
      actorType,
      actorId: actorId ?? null,
      userId: actorType === "admin" ? actorId ?? null : null,
      teamId,
      eventId: team.eventId,
      details: JSON.stringify(auditDetails),
    },
  });

  // El puntaje de recorrido depende de la cantidad de postas: recalcular.
  await recomputeStationsScoreForTeam(teamId).catch(() => undefined);

  return { count: route.count };
}

export async function resetTeamProgress(
  teamId: string,
  actorType: string,
  actorId?: string
) {
  const team = await prisma.team.findUnique({
    where: { id: teamId },
    include: { event: true },
  });
  if (!team) throw ApiError.notFound("Equipo no encontrado");

  const previous = await prisma.stationVisit.count({ where: { teamId } });

  await prisma.stationVisit.deleteMany({ where: { teamId } });

  await prisma.auditLog.create({
    data: {
      action: "PROGRESS_RESET",
      entity: "StationVisit",
      entityId: team.id,
      actorType,
      actorId: actorId ?? null,
      userId: actorType === "admin" ? actorId ?? null : null,
      teamId,
      eventId: team.eventId,
      details: JSON.stringify({ deletedVisits: previous, timestamp: new Date().toISOString() }),
    },
  });

  // El recorrido vuelve a cero: recalcular el puntaje de postas.
  await recomputeStationsScoreForTeam(teamId).catch(() => undefined);

  return { deletedVisits: previous };
}

/**
 * Admin override: marks a station as skipped for a team (e.g. the QR was lost
 * and coordinators authorized the skip off-line). Never overrides a VALID
 * visit. Recomputes the STATIONS score.
 */
export async function skipTeamStation(
  teamId: string,
  stationId: string,
  reason: string,
  actorType: string,
  actorId?: string
) {
  const team = await prisma.team.findUnique({ where: { id: teamId } });
  if (!team) throw ApiError.notFound("Equipo no encontrado");
  const station = await prisma.station.findUnique({ where: { id: stationId } });
  if (!station) throw ApiError.notFound("Posta no encontrada");
  if (station.eventId !== team.eventId) {
    throw ApiError.badRequest("La posta no pertenece al evento del equipo");
  }

  const existing = await prisma.stationVisit.findFirst({
    where: { teamId, stationId, status: { in: ["VALID", "SKIPPED"] } },
    select: { status: true },
  });
  if (existing?.status === "VALID") {
    throw ApiError.conflict("El equipo ya completo esta posta");
  }
  if (existing?.status === "SKIPPED") {
    return { skipped: true, alreadySkipped: true };
  }

  try {
    await prisma.stationVisit.create({
      data: {
        eventId: team.eventId,
        teamId,
        stationId,
        status: "SKIPPED",
        isCorrect: false,
        skipReason: reason ? reason.slice(0, 300) : null,
        validKey: `${teamId}:${stationId}`,
      },
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return { skipped: true, alreadySkipped: true };
    }
    throw err;
  }

  await prisma.auditLog.create({
    data: {
      action: "STATION_SKIPPED",
      entity: "StationVisit",
      entityId: team.id,
      actorType,
      actorId: actorId ?? null,
      userId: actorType === "admin" ? actorId ?? null : null,
      teamId,
      eventId: team.eventId,
      details: JSON.stringify({ stationId, reason: reason || null, source: "admin" }),
    },
  });

  await recomputeStationsScoreForTeam(teamId).catch(() => undefined);
  return { skipped: true, alreadySkipped: false };
}

/** Admin override: undoes a skipped station for a team and recomputes score. */
export async function unskipTeamStation(
  teamId: string,
  stationId: string,
  actorType: string,
  actorId?: string
) {
  const team = await prisma.team.findUnique({ where: { id: teamId } });
  if (!team) throw ApiError.notFound("Equipo no encontrado");

  const deleted = await prisma.stationVisit.deleteMany({
    where: { teamId, stationId, status: "SKIPPED" },
  });

  if (deleted.count > 0) {
    await prisma.auditLog.create({
      data: {
        action: "STATION_UNSKIPPED",
        entity: "StationVisit",
        entityId: team.id,
        actorType,
        actorId: actorId ?? null,
        userId: actorType === "admin" ? actorId ?? null : null,
        teamId,
        eventId: team.eventId,
        details: JSON.stringify({ stationId }),
      },
    });
    await recomputeStationsScoreForTeam(teamId).catch(() => undefined);
  }

  return { removed: deleted.count };
}