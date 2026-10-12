import { prisma } from "@/lib/prisma";
import { ApiError } from "@/utils/errors";
import {
  computeProgress,
} from "@/modules/progress/progress.service";

export async function getDashboard(eventId: string) {
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    include: {
      _count: { select: { teams: true, stations: true, visits: true } },
      stations: {
        orderBy: { name: "asc" },
        select: {
          id: true,
          name: true,
          active: true,
          challengeType: true,
          _count: { select: { visits: true } },
        },
      },
    },
  });
  if (!event) throw ApiError.notFound("Evento no encontrado");

  const teams = await prisma.team.findMany({
    where: { eventId },
    include: {
      routeStops: { orderBy: { position: "asc" }, include: { station: true } },
      visits: { orderBy: { visitedAt: "asc" } },
    },
  });

  const stationNames = new Map(
    event.stations.map((s) => [s.id, s.name] as const)
  );

  let teamsStarted = 0;
  let teamsFinished = 0;

  const rows = teams.map((team) => {
    const progress = computeProgress(team);
    if (progress.completed > 0) teamsStarted++;
    if (progress.done) teamsFinished++;
    const allVisits = team.visits;
    const lastVisit = allVisits[allVisits.length - 1] ?? null;
    const correctAnswers = allVisits.filter((v) => v.isCorrect).length;
    const wrongAnswers = allVisits.filter((v) => v.isCorrect === false).length;
    const nextStationId = progress.nextStationId;
    return {
      teamId: team.id,
      team: team.name,
      eventId,
      active: team.active,
      username: team.username,
      totalStops: progress.total,
      completed: progress.completed,
      done: progress.done,
      nextStation: nextStationId ? (stationNames.get(nextStationId) ?? null) : null,
      lastActivity: lastVisit ? lastVisit.visitedAt.toISOString() : null,
      startAt: progress.startAt,
      finishAt: progress.finishAt,
      status: progress.done
        ? "FINALIZADO"
        : progress.completed > 0
          ? "EN_RECORRIDO"
          : team.active
            ? "NO_INICIADO"
            : "INACTIVO",
      correctAnswers,
      wrongAnswers,
    };
  });

  const lastVisits = await prisma.stationVisit.findMany({
    where: { eventId },
    orderBy: { visitedAt: "desc" },
    take: 20,
    include: {
      team: { select: { id: true, name: true } },
      station: { select: { id: true, name: true } },
    },
  });

  return {
    event: {
      id: event.id,
      name: event.name,
      status: event.status,
      date: event.date.toISOString(),
    },
    counts: {
      teams: event._count.teams,
      activeTeams: teams.filter((t) => t.active).length,
      stations: event._count.stations,
      visits: event._count.visits,
      teamsStarted,
      teamsInProgress: teamsStarted - teamsFinished,
      teamsFinished,
      teamsNotStarted: event._count.teams - teamsStarted,
    },
    teams: rows,
    lastVisits: lastVisits.map((v) => ({
      id: v.id,
      teamId: v.team.id,
      team: v.team.name,
      stationId: v.station.id,
      station: v.station.name,
      visitedAt: v.visitedAt.toISOString(),
      status: v.status,
      isCorrect: v.isCorrect,
      attemptNumber: v.attemptNumber,
    })),
  };
}

export async function buildResultsCsv(eventId: string): Promise<string> {
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    include: {
      stations: { orderBy: { name: "asc" } },
    },
  });
  if (!event) throw ApiError.notFound("Evento no encontrado");

  const stations = [...event.stations].sort((a, b) => a.name.localeCompare(b.name));
  const teams = await prisma.team.findMany({
    where: { eventId },
    orderBy: { name: "asc" },
    include: {
      routeStops: { orderBy: { position: "asc" } },
      visits: { orderBy: { visitedAt: "asc" } },
    },
  });

  const header = [
    "Equipo",
    "Progreso",
    "Inicio",
    "Fin",
    "Respuestas correctas",
    "Respuestas incorrectas",
    "Resultado",
  ];
  for (const s of stations) {
    const pos = s.name;
    header.push(`Posta: ${pos} - Estado`);
  }

  const cells: (string | number)[][] = [header];

  const esc = (v: string | number | null) => {
    if (v === null || v === undefined) return "";
    const s = String(v);
    return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };

  for (const team of teams) {
    const progress = computeProgress(team);
    const validSet = new Set(
      team.visits.filter((v) => v.status === "VALID").map((v) => v.stationId)
    );
    const byStation = new Map(
      team.visits.map((v) => [v.stationId, v as (typeof team.visits)[number]])
    );
    const correct = team.visits.filter((v) => v.isCorrect).length;
    const wrong = team.visits.filter((v) => v.isCorrect === false).length;
    const stationOrder = [...team.routeStops]
      .sort((a, b) => a.position - b.position)
      .map((s) => s.stationId);

    const row = [
      team.name,
      `${progress.completed}/${progress.total}`,
      progress.startAt ? new Date(progress.startAt).toISOString() : "",
      progress.finishAt ? new Date(progress.finishAt).toISOString() : "",
      correct,
      wrong,
      progress.done ? "COMPLETADO" : progress.completed > 0 ? "EN CURSO" : "SIN INICIAR",
    ];

    for (const s of stations) {
      const visit = byStation.get(s.id) ?? null;
      let cell = "No asignada";
      if (stationOrder.includes(s.id)) {
        cell = validSet.has(s.id)
          ? "OK"
          : visit
            ? `Fallida (${visit.attemptNumber})`
            : "Pendiente";
      }
      row.push(cell);
    }
    cells.push(row);
  }

  return cells.map((row) => row.map(esc).join(",")).join("\r\n");
}