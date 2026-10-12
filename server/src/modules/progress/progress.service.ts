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
  completed: number;
  done: boolean;
  nextStationId: string | null;
  nextPosition: number | null;
  startAt: string | null;
  finishAt: string | null;
  visitedStations: string[];
};

/**
 * Computes the team progress from its route and valid visits. The next station
 * is the first stop (by position) whose station has no VALID visit.
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
  const validByStation = new Set(
    team.visits.filter((v) => v.status === "VALID").map((v) => v.stationId)
  );
  const completedStations = team.routeStops.filter((s) =>
    validByStation.has(s.stationId)
  );
  const total = team.routeStops.length;
  const completed = completedStations.length;

  const validVisits = team.visits.filter((v) => v.status === "VALID");
  const firstValid = validVisits[0];
  const lastValid = validVisits[validVisits.length - 1];

  const nextStop =
    team.routeStops.find((s) => !validByStation.has(s.stationId)) ?? null;

  return {
    total,
    completed,
    done: completed >= total && total > 0,
    nextStationId: nextStop?.stationId ?? null,
    nextPosition: nextStop?.position ?? null,
    startAt: firstValid ? firstValid.visitedAt.toISOString() : null,
    finishAt:
      completed >= total && total > 0 && lastValid
        ? lastValid.visitedAt.toISOString()
        : null,
    visitedStations: validVisits.map((v) => v.stationId),
  };
}

export async function computeProgressForTeam(teamId: string) {
  const team = await getTeamWithRuntime(teamId);
  if (!team) return null;
  return computeProgress(team);
}