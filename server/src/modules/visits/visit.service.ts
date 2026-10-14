import type { ChallengeType, VisitStatus } from "@prisma/client";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ApiError } from "@/utils/errors";
import { computeProgress } from "@/modules/progress/progress.service";
import { googleMapsDirectionsUrl } from "@/utils/geo";
import { recomputeStationsScoreForTeam } from "@/modules/scoring/scoring.service";

const normalize = (value: string) =>
  value
    .trim()
    .toLocaleLowerCase("es")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

// Una posta queda "resuelta" cuando el equipo la supera (VALID) o la salta con
// la frase de rescate (SKIPPED).
const RESOLVED_STATUSES: VisitStatus[] = ["VALID", "SKIPPED"];

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

/** First route stop (by position) the team has not resolved yet. */
async function findNextUnresolvedStop(
  teamId: string,
  resolved: Set<string>
): Promise<{ stationId: string; position: number } | null> {
  const stops = await prisma.routeStop.findMany({
    where: { teamId },
    orderBy: { position: "asc" },
    select: { stationId: true, position: true },
  });
  return stops.find((s) => !resolved.has(s.stationId)) ?? null;
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

type RouteStopOverride = {
  question: string | null;
  questionAnswer: string | null;
} | null;

/**
 * Resolves the effective challenge for a team at a given stop. If the team's
 * itinerary carries a bonus question for that stop, it overrides the station's
 * default challenge (lets each team get its own question at a shared station).
 */
function resolveChallenge(
  stop: RouteStopOverride,
  station: {
    challengeType: ChallengeType;
    instructions: string | null;
    expectedAnswer: string | null;
    autoAcceptAny: boolean;
  }
) {
  const question = stop?.question?.trim();
  if (question) {
    const answer = stop?.questionAnswer?.trim() || null;
    return {
      challengeType: (answer ? "QUESTION" : "AUTO") as ChallengeType,
      instructions: question,
      expectedAnswer: answer,
      autoAcceptAny: !answer,
    };
  }
  return {
    challengeType: station.challengeType,
    instructions: station.instructions,
    expectedAnswer: station.expectedAnswer,
    autoAcceptAny: station.autoAcceptAny,
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
      routeStops: { where: { teamId }, select: { position: true, question: true, questionAnswer: true } },
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
  const resolvedVisits = await prisma.stationVisit.findMany({
    where: { teamId, status: { in: RESOLVED_STATUSES } },
    select: { stationId: true },
  });
  const resolvedSet = new Set(resolvedVisits.map((v) => v.stationId));

  if (resolvedSet.has(station.id)) {
    return { status: "COMPLETED" as StationChallengeStatus };
  }
  const nextStop = await findNextUnresolvedStop(teamId, resolvedSet);
  if (position === null || nextStop === null || position !== nextStop.position) {
    return { status: "NOT_YOUR_NEXT" as StationChallengeStatus };
  }

  const stop = station.routeStops[0] ?? null;
  const eff = resolveChallenge(stop, station);
  return {
    status: "NEXT" as StationChallengeStatus,
    station: {
      id: station.id,
      name: station.name,
      description: station.description,
      instructions: eff.instructions,
      challengeType: eff.challengeType,
      autoAcceptAny: eff.autoAcceptAny,
      displayedCode: eff.challengeType === "CODE" ? station.displayedCode : null,
    },
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
  const accepted = expectedAnswer.split("|").map(normalize);
  return { isCorrect: accepted.includes(normalize(answer)) };
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

export type SkipResult =
  | {
      result: "SKIPPED";
      message: string;
      skippedStation: { id: string; name: string; position: number };
      nextStation: { id: string; name: string; position: number } | null;
      remaining: number;
    }
  | {
      result:
        | "RESCUE_PHRASE_INVALID"
        | "SKIP_DISABLED"
        | "ALL_RESOLVED"
        | "EVENT_NOT_READY"
        | "EVENT_FINISHED"
        | "EVENT_CANCELLED"
        | "ALREADY_COMPLETED"
        | "NOT_YOUR_NEXT";
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
  SKIPPED: "Posta saltada",
  RESCUE_PHRASE_INVALID: "Frase de rescate incorrecta",
  SKIP_DISABLED: "Esta posta no permite salto. Avisa a la organizacion.",
  ALL_RESOLVED: "Ya resolviste todas las postas del recorrido",
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

      const resolvedVisits = await tx.stationVisit.findMany({
        where: { teamId, status: { in: RESOLVED_STATUSES } },
        select: { stationId: true },
      });
      const resolvedSet = new Set(resolvedVisits.map((v) => v.stationId));

      const route = await tx.routeStop.findMany({
        where: { teamId },
        orderBy: { position: "asc" },
        include: { station: { select: { id: true, name: true } } },
      });

      if (resolvedSet.has(station.id)) {
        return { result: "ALREADY_COMPLETED" as const, message: messageFor("ALREADY_COMPLETED") };
      }

      const nextStop = route.find((s) => !resolvedSet.has(s.stationId)) ?? null;
      if (!nextStop || nextStop.stationId !== station.id) {
        return { result: "NOT_YOUR_NEXT" as const, message: messageFor("NOT_YOUR_NEXT") };
      }

      const stop = station.routeStops[0] ?? null;
      const eff = resolveChallenge(stop, station);
      const { isCorrect } = evaluateAnswer(
        eff.challengeType,
        eff.autoAcceptAny,
        eff.expectedAnswer,
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

      resolvedSet.add(station.id);
      const afterStop = route.find((s) => !resolvedSet.has(s.stationId)) ?? null;
      return {
        result: "VALID" as const,
        message: messageFor("VALID"),
        nextStation: afterStop
          ? { id: afterStop.stationId, name: afterStop.station.name, position: afterStop.position }
          : null,
        remaining: route.length - resolvedSet.size,
      } as const;
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
  );

  const result = await withSerializableRetry(runTransaction);

  if ((result as { result?: string }).result === "VALID") {
    await recomputeStationsScoreForTeam(teamId).catch(() => undefined);
  }

  return result as unknown as RegisterResult;
}

/**
 * Skips the team's current (next unresolved) station when the QR cannot be
 * scanned. Requires the rescue phrase configured for that station (dictated by
 * the coordinators). The skipped station counts as semi-completed (half score).
 */
export async function skipStation(
  phrase: string,
  reason: string,
  teamId: string
): Promise<SkipResult> {
  await loadTeamCtx(teamId);

  const runTransaction = () =>
    prisma.$transaction(
      async (tx) => {
        const team = await tx.team.findUnique({
          where: { id: teamId },
          include: { event: { select: { status: true } } },
        });
        if (!team) throw ApiError.unauthorized("Sesion de equipo invalida");

        const eventStatus: string = team.event.status;
        if (eventStatus === "PREPARED")
          return { result: "EVENT_NOT_READY" as const, message: messageFor("EVENT_NOT_READY") };
        if (eventStatus === "FINISHED")
          return { result: "EVENT_FINISHED" as const, message: messageFor("EVENT_FINISHED") };
        if (eventStatus === "CANCELLED")
          return { result: "EVENT_CANCELLED" as const, message: messageFor("EVENT_CANCELLED") };

        const route = await tx.routeStop.findMany({
          where: { teamId },
          orderBy: { position: "asc" },
          include: { station: { select: { id: true, name: true, rescuePhrase: true } } },
        });
        const resolvedVisits = await tx.stationVisit.findMany({
          where: { teamId, status: { in: RESOLVED_STATUSES } },
          select: { stationId: true },
        });
        const resolvedSet = new Set(resolvedVisits.map((v) => v.stationId));

        const nextStop = route.find((s) => !resolvedSet.has(s.stationId)) ?? null;
        if (!nextStop) {
          return { result: "ALL_RESOLVED" as const, message: messageFor("ALL_RESOLVED") };
        }

        const station = nextStop.station;
        const configured = station.rescuePhrase?.trim();
        if (!configured) {
          return { result: "SKIP_DISABLED" as const, message: messageFor("SKIP_DISABLED") };
        }
        if (normalize(phrase) !== normalize(configured)) {
          return {
            result: "RESCUE_PHRASE_INVALID" as const,
            message: messageFor("RESCUE_PHRASE_INVALID"),
          };
        }

        const key = `${teamId}:${station.id}`;
        try {
          await tx.stationVisit.create({
            data: {
              eventId: team.eventId,
              teamId,
              stationId: station.id,
              status: "SKIPPED",
              isCorrect: false,
              submittedAnswer: null,
              skipReason: reason ? reason.slice(0, 300) : null,
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

        resolvedSet.add(station.id);
        const afterStop = route.find((s) => !resolvedSet.has(s.stationId)) ?? null;
        return {
          result: "SKIPPED" as const,
          message: messageFor("SKIPPED"),
          skippedStation: { id: station.id, name: station.name, position: nextStop.position },
          nextStation: afterStop
            ? { id: afterStop.stationId, name: afterStop.station.name, position: afterStop.position }
            : null,
          remaining: route.length - resolvedSet.size,
        } as const;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    );

  const result = await withSerializableRetry(runTransaction);

  if ((result as { result?: string }).result === "SKIPPED") {
    await recomputeStationsScoreForTeam(teamId).catch(() => undefined);
  }

  return result as unknown as SkipResult;
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
      const skipped = team.visits.find(
        (v) => v.status === "SKIPPED" && v.stationId === stop.stationId
      );
      const lastAttempt = team.visits.find((v) => v.stationId === stop.stationId);
      const { latitude, longitude } = stop.station;
      const hasCoords = latitude !== null && longitude !== null;
      return {
        position: stop.position,
        stationId: stop.station.id,
        name: stop.station.name,
        challengeType: resolveChallenge(stop, stop.station).challengeType,
        completed: Boolean(valid),
        completedAt: valid?.visitedAt.toISOString() ?? null,
        skipped: Boolean(skipped),
        skippedAt: skipped?.visitedAt.toISOString() ?? null,
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
