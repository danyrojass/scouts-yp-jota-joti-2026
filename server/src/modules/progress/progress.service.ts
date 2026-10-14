import { prisma } from "@/lib/prisma";

export async function getTeamWithRuntime(teamId: string) {
  const team = await prisma.team.findUnique({
    where: { id: teamId },
    include: {
      event: true,
      routeStops: {
        orderBy: { position: "asc" },
        include: { station: true },
      },
      visits: { orderBy: { visitedAt: "asc" } },
    },
  });
  return team;
}

export type ProgressSnapshot = {
  total: number;
  // Postas RESUELTAS (VALID + SKIPPED). Es el avance real del recorrido.
  completed: number;
  // Postas superadas con el QR (VALID).
  valid: number;
  // Postas saltadas con la frase de rescate (SKIPPED).
  skipped: number;
  done: boolean;
  nextStationId: string | null;
  nextPosition: number | null;
  startAt: string | null;
  finishAt: string | null;
  visitedStations: string[];
  resolvedStations: string[];
};

// Una posta queda "resuelta" cuando el equipo la supera (VALID) o la salta con
// la frase de rescate (SKIPPED). El recorrido avanza segun postas resueltas.
const RESOLVED_STATUSES = new Set(["VALID", "SKIPPED"]);

/**
 * Computes the team progress from its route and visits. The next station is the
 * first stop (by position) whose station is not resolved yet. A skipped station
 * counts as resolved (so the team can keep advancing) but not as valid.
 */
export function computeProgress(team: {
  routeStops: { position: number; stationId: string }[];
  visits: {
    status: string;
    isCorrect: boolean | null;
    stationId: string;
    visitedAt: Date;
  }[];
}): ProgressSnapshot {
  const resolvedByStation = new Set(
    team.visits
      .filter((v) => RESOLVED_STATUSES.has(v.status))
      .map((v) => v.stationId)
  );
  const validByStation = new Set(
    team.visits.filter((v) => v.status === "VALID").map((v) => v.stationId)
  );

  const total = team.routeStops.length;
  let completed = 0;
  let skipped = 0;
  for (const stop of team.routeStops) {
    if (!resolvedByStation.has(stop.stationId)) continue;
    completed++;
    if (!validByStation.has(stop.stationId)) skipped++;
  }
  const valid = completed - skipped;

  const resolvedVisits = team.visits.filter((v) => RESOLVED_STATUSES.has(v.status));
  const resolvedTimes = resolvedVisits.map((v) => v.visitedAt.getTime());
  const startAt = resolvedTimes.length
    ? new Date(Math.min(...resolvedTimes)).toISOString()
    : null;
  const done = total > 0 && completed >= total;
  const finishAt =
    done && resolvedTimes.length
      ? new Date(Math.max(...resolvedTimes)).toISOString()
      : null;

  const nextStop =
    team.routeStops.find((s) => !resolvedByStation.has(s.stationId)) ?? null;

  return {
    total,
    completed,
    valid,
    skipped,
    done,
    nextStationId: nextStop?.stationId ?? null,
    nextPosition: nextStop?.position ?? null,
    startAt,
    finishAt,
    visitedStations: [...validByStation],
    resolvedStations: [...resolvedByStation],
  };
}

export async function computeProgressForTeam(teamId: string) {
  const team = await getTeamWithRuntime(teamId);
  if (!team) return null;
  return computeProgress(team);
}
