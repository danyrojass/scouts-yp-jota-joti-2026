import type { ChallengeType } from "@prisma/client";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ApiError } from "@/utils/errors";
import { computeProgress } from "@/modules/progress/progress.service";
import { googleMapsDirectionsUrl } from "@/utils/geo";

const normalize = (value: string) =>
  value
    .trim()
    .toLocaleLowerCase("es")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

type TeamCtx = {
  id: string;
  eventId: string;
  eventStatus: string;
};

async function loadTeamCtx(teamId: string): Promise<TeamCtx> {
  const team = await prisma.team.findUnique({
    where: { id: teamId },
    include: { event: { select: { status: true } } },
  });
  if (!team) throw ApiError.unauthorized("Sesion de equipo invalida");
  return { id: team.id, eventId: team.eventId, eventStatus: team.event.status };
}

export type StationChallengeStatus =
  | "NEXT"
  | "NOT_YOUR_NEXT"
  | "COMPLETED"
  | "INACTIVE"
  | "EVENT_NOT_READY"
  | "EVENT_FINISHED"
  | "EVENT_CANCELLED"
  | "WRONG_EVENT";

const EVENT_CHECK: Record<string, StationChallengeStatus> = {
  PREPARED: "EVENT_NOT_READY",
  IN_PROGRESS: "NEXT",
  FINISHED: "EVENT_FINISHED",
  CANCELLED: "EVENT_CANCELLED",
};

function publicStation(
  station: { id: string; name: string; description: string | null; instructions: string | null; displayedCode: string | null; challengeType: ChallengeType; autoAcceptAny: boolean },
  includeDisplayed: boolean
) {
  return {
    id: station.id,
    name: station.name,
    description: station.description,
    instructions: station.instructions,
    challengeType: station.challengeType,
    autoAcceptAny: station.autoAcceptAny,
    displayedCode: includeDisplayed ? station.displayedCode : null,
  };
}

/**
 * Resolves the challenge screen state for a scanned station, always from the
 * authenticated team's perspective.
 */
export async function resolveStationChallenge(publicToken: string, teamId: string) {
  const team = await loadTeamCtx(teamId);

  const station = await prisma.station.findUnique({
    where: { publicToken },
    include: {
      routeStops: { where: { teamId }, select: { position: true } },
    },
  });

  if (!station) throw ApiError.notFound("Codigo QR invalido");
  if (station.eventId !== team.eventId) {
    return { status: "WRONG_EVENT" as StationChallengeStatus };
  }

  const eventStatus = EVENT_CHECK[team.eventStatus];
  if (eventStatus !== "NEXT") {
    return { status: eventStatus };
  }
  if (!station.active) return { status: "INACTIVE" as StationChallengeStatus };

  const position = station.routeStops[0]?.position ?? null;
  const validVisits = await prisma.stationVisit.findMany({
    where: { teamId, status: "VALID" },
    select: { stationId: true },
  });
  const completedSet = new Set(validVisits.map((v) => v.stationId));

  if (completedSet.has(station.id)) {
    return { status: "COMPLETED" as StationChallengeStatus };
  }
  if (position === null || position !== completedSet.size + 1) {
    return { status: "NOT_YOUR_NEXT" as StationChallengeStatus };
  }

  return {
    status: "NEXT" as StationChallengeStatus,
    station: publicStation(station, true),
  };
}

function evaluateAnswer(
  challengeType: ChallengeType,
  autoAcceptAny: boolean,
  expectedAnswer: string | null,
  answer: string
) {
  if (challengeType === "CONFIRMATION") {
    return { isCorrect: true };
  }
  if (challengeType === "AUTO" && autoAcceptAny) {
    return { isCorrect: answer.trim().length > 0 };
  }
  if (!expectedAnswer) {
    return { isCorrect: false };
  }
  return { isCorrect: normalize(answer) === normalize(expectedAnswer) };
}

export type RegisterResult =
  | {
      result: "VALID";
      message: string;
      nextStation: { id: string; name: string; position: number } | null;
      remaining: number;
    }
  | {
      result: "INCORRECT";
      message: string;
      attemptNumber: number;
    }
  | {
      result: "ALREADY_COMPLETED" | "NOT_YOUR_NEXT" | "EVENT_NOT_READY" | "EVENT_FINISHED" | "EVENT_CANCELLED" | "INACTIVE" | "WRONG_EVENT";
      message: string;
    };

const STATUS_MESSAGES: Record<string, string> = {
  VALID: "Pista superada",
  INCORRECT: "Respuesta incorrecta",
  ALREADY_COMPLETED: "Esta posta ya fue completada",
  NOT_YOUR_NEXT: "Esta no es tu proxima posta. Consulta el itinerario de tu equipo.",
  EVENT_NOT_READY: "El evento todavia no comenzo",
  EVENT_FINISHED: "El evento ya finalizo",
  EVENT_CANCELLED: "El evento fue cancelado",
  INACTIVE: "Esta posta esta desactivada",
  WRONG_EVENT: "Esta posta no pertenece a tu evento",
} as const;

function messageFor(status: string): string {
  return (
    (STATUS_MESSAGES as Record<string, string>)[status] ?? "Operacion no permitida"
  );
}

/**
 * Retries a transaction that aborted with a Postgres serialization failure
 * (Prisma P2034). With Serializable isolation, concurrent inserts that contend
 * on the same `validKey` may abort; the loser is retried and then observes the
 * winner's committed row, resolving to ALREADY_COMPLETED instead of an error.
 */
async function withSerializableRetry<T>(run: () => Promise<T>, maxAttempts = 5): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await run();
    } catch (err) {
      const isSerializationFailure =
        err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2034";
      if (!isSerializationFailure || attempt >= maxAttempts) throw err;
      await new Promise((resolve) => setTimeout(resolve, 15 * attempt));
    }
  }
}

/**
 * Registers a visit with full server-side validation in a serializable
 * transaction. Concurrent double-validation is prevented by the unique
 * `validKey` column, so at most one VALID visit per team+station can exist.
 */
export async function registerVisit(
  publicToken: string,
  answer: string,
  teamId: string
): Promise<RegisterResult> {
  await loadTeamCtx(teamId);

  const runTransaction = () =>
    prisma.$transaction(
    async (tx) => {
      const team = await tx.team.findUnique({
        where: { id: teamId },
        include: { event: { select: { status: true } } },
      });
      if (!team) throw ApiError.unauthorized("Sesion de equipo invalida");

      const station = await tx.station.findUnique({
        where: { publicToken },
        include: {
          routeStops: { where: { teamId }, orderBy: { position: "asc" } },
        },
      });
      if (!station) throw ApiError.notFound("Codigo QR invalido");
      if (station.eventId !== team.eventId) {
        return { result: "WRONG_EVENT" as const, message: messageFor("WRONG_EVENT") };
      }

      const eventStatus: string = team.event.status;
      if (eventStatus === "PREPARED")
        return { result: "EVENT_NOT_READY" as const, message: messageFor("EVENT_NOT_READY") };
      if (eventStatus === "FINISHED")
        return { result: "EVENT_FINISHED" as const, message: messageFor("EVENT_FINISHED") };
      if (eventStatus === "CANCELLED")
        return { result: "EVENT_CANCELLED" as const, message: messageFor("EVENT_CANCELLED") };
      if (!station.active)
        return { result: "INACTIVE" as const, message: messageFor("INACTIVE") };

      const validVisits = await tx.stationVisit.findMany({
        where: { teamId, status: "VALID" },
        select: { stationId: true },
      });
      const completedSet = new Set(validVisits.map((v) => v.stationId));

      if (completedSet.has(station.id)) {
        return { result: "ALREADY_COMPLETED" as const, message: messageFor("ALREADY_COMPLETED") };
      }

      const position = station.routeStops[0]?.position ?? null;
      if (position === null || position !== completedSet.size + 1) {
        return { result: "NOT_YOUR_NEXT" as const, message: messageFor("NOT_YOUR_NEXT") };
      }

      const { isCorrect } = evaluateAnswer(
        station.challengeType,
        station.autoAcceptAny,
        station.expectedAnswer,
        answer
      );

      const priorAttempts = await tx.stationVisit.count({
        where: { teamId, stationId: station.id },
      });

      if (!isCorrect) {
        await tx.stationVisit.create({
          data: {
            eventId: team.eventId,
            teamId,
            stationId: station.id,
            status: "INCORRECT",
            isCorrect: false,
            submittedAnswer: answer ? answer.slice(0, 500) : null,
            attemptNumber: priorAttempts + 1,
          },
        });
        return {
          result: "INCORRECT" as const,
          message: messageFor("INCORRECT"),
          attemptNumber: priorAttempts + 1,
        } as const;
      }

      const key = `${teamId}:${station.id}`;
      try {
        await tx.stationVisit.create({
          data: {
            eventId: team.eventId,
            teamId,
            stationId: station.id,
            status: "VALID",
            isCorrect: true,
            submittedAnswer: answer ? answer.slice(0, 500) : null,
            attemptNumber: priorAttempts + 1,
            validKey: key,
          },
        });
      } catch (err) {
        if (
          err instanceof Prisma.PrismaClientKnownRequestError &&
          err.code === "P2002"
        ) {
          return {
            result: "ALREADY_COMPLETED" as const,
            message: messageFor("ALREADY_COMPLETED"),
          } as const;
        }
        throw err;
      }

      completedSet.add(station.id);
      const route = await tx.routeStop.findMany({
        where: { teamId },
        orderBy: { position: "asc" },
        include: { station: { select: { id: true, name: true } } },
      });
      const nextStop = route.find((s) => !completedSet.has(s.stationId)) ?? null;
      return {
        result: "VALID" as const,
        message: messageFor("VALID"),
        nextStation: nextStop
          ? { id: nextStop.stationId, name: nextStop.station.name, position: nextStop.position }
          : null,
        remaining: route.length - completedSet.size,
      } as const;
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
  );

  const result = await withSerializableRetry(runTransaction);

  return result as unknown as RegisterResult;
}

/** Progress snapshot for the team passport, from the server. */
export async function teamPassport(teamId: string) {
  const team = await prisma.team.findUnique({
    where: { id: teamId },
    include: {
      event: { select: { id: true, name: true, status: true } },
      routeStops: {
        orderBy: { position: "asc" },
        include: { station: true },
      },
      visits: { orderBy: { visitedAt: "desc" } },
    },
  });
  if (!team) throw ApiError.unauthorized("Sesion de equipo invalida");

  const progress = computeProgress(team);

  const stops = [...team.routeStops]
    .sort((a, b) => a.position - b.position)
    .map((stop) => {
      const valid = team.visits.find(
        (v) => v.status === "VALID" && v.stationId === stop.stationId
      );
      const lastAttempt = team.visits.find((v) => v.stationId === stop.stationId);
      const { latitude, longitude } = stop.station;
      const hasCoords = latitude !== null && longitude !== null;
      return {
        position: stop.position,
        stationId: stop.station.id,
        name: stop.station.name,
        challengeType: stop.station.challengeType,
        completed: Boolean(valid),
        completedAt: valid?.visitedAt.toISOString() ?? null,
        lastAttemptAt: lastAttempt?.visitedAt.toISOString() ?? null,
        attempts: team.visits.filter((v) => v.stationId === stop.stationId).length,
        latitude,
        longitude,
        mapsUrl: hasCoords ? googleMapsDirectionsUrl(latitude, longitude) : null,
      };
    });

  const history = team.visits.slice(0, 50).map((v) => ({
    id: v.id,
    stationId: v.stationId,
    stationName: team.routeStops.find((r) => r.stationId === v.stationId)?.station.name ?? null,
    visitedAt: v.visitedAt.toISOString(),
    status: v.status,
    isCorrect: v.isCorrect,
    attemptNumber: v.attemptNumber,
  }));

  return {
    team: { id: team.id, name: team.name, username: team.username },
    event: { id: team.event.id, name: team.event.name, status: team.event.status },
    progress,
    stops,
    history,
  };
}