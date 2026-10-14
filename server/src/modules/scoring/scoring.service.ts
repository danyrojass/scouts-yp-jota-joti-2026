import type { ActivityStatus, Prisma, ScoringMethod } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ApiError } from "@/utils/errors";

const EPSILON = 1e-9;
const activityOrder: Prisma.ActivityOrderByWithRelationInput[] = [
  { position: "asc" },
  { createdAt: "asc" },
];

/** Redondeo a 2 decimales para evitar ruido de punto flotante en totales. */
function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

type ActivityInput = {
  name?: string;
  description?: string | null;
  maxScore?: number | null;
  position?: number;
  status?: ActivityStatus;
  scoringMethod?: ScoringMethod;
  published?: boolean;
  allowMaxScoreExceeded?: boolean;
  active?: boolean;
};

// ---------------------------------------------------------------------------
// Actividades
// ---------------------------------------------------------------------------

export async function listActivities(eventId: string) {
  const event = await prisma.event.findUnique({ where: { id: eventId } });
  if (!event) throw ApiError.notFound("Evento no encontrado");
  return prisma.activity.findMany({ where: { eventId }, orderBy: activityOrder });
}

export async function createActivity(
  eventId: string,
  data: ActivityInput & { name: string }
) {
  const event = await prisma.event.findUnique({ where: { id: eventId } });
  if (!event) throw ApiError.notFound("Evento no encontrado");

  let position = data.position;
  if (position === undefined) {
    const last = await prisma.activity.findFirst({
      where: { eventId },
      orderBy: { position: "desc" },
    });
    position = (last?.position ?? 0) + 1;
  }

  return prisma.activity.create({
    data: {
      eventId,
      name: data.name,
      description: data.description ?? null,
      maxScore: data.maxScore ?? null,
      position,
      status: data.status ?? "PENDING",
      scoringMethod: data.scoringMethod ?? "MANUAL",
      published: data.published ?? false,
      allowMaxScoreExceeded: data.allowMaxScoreExceeded ?? false,
      active: data.active ?? true,
    },
  });
}

export async function updateActivity(id: string, data: ActivityInput) {
  const activity = await prisma.activity.findUnique({ where: { id } });
  if (!activity) throw ApiError.notFound("Actividad no encontrada");
  return prisma.activity.update({
    where: { id },
    data: {
      name: data.name ?? undefined,
      description: data.description !== undefined ? data.description : undefined,
      maxScore: data.maxScore !== undefined ? data.maxScore : undefined,
      position: data.position ?? undefined,
      status: data.status ?? undefined,
      scoringMethod: data.scoringMethod ?? undefined,
      published: data.published ?? undefined,
      allowMaxScoreExceeded: data.allowMaxScoreExceeded ?? undefined,
      active: data.active ?? undefined,
    },
  });
}

export async function deleteActivity(id: string) {
  const activity = await prisma.activity.findUnique({ where: { id } });
  if (!activity) throw ApiError.notFound("Actividad no encontrada");
  return prisma.activity.delete({ where: { id } });
}

/** Reordena todas las actividades del evento; la lista debe contenerlas todas. */
export async function reorderActivities(eventId: string, activityIds: string[]) {
  const activities = await prisma.activity.findMany({
    where: { eventId },
    select: { id: true },
  });
  const ids = new Set(activities.map((a) => a.id));
  if (
    activityIds.length !== activities.length ||
    activityIds.some((id) => !ids.has(id)) ||
    new Set(activityIds).size !== activityIds.length
  ) {
    throw ApiError.badRequest(
      "La lista debe incluir todas las actividades del evento sin repetir"
    );
  }

  await prisma.$transaction(
    activityIds.map((id, index) =>
      prisma.activity.update({ where: { id }, data: { position: index + 1 } })
    )
  );
}

// ---------------------------------------------------------------------------
// Carga de puntajes
// ---------------------------------------------------------------------------

function serializeScore(s: {
  id: string;
  eventId: string;
  teamId: string;
  activityId: string;
  score: number | null;
  evaluated: boolean;
  observations: string | null;
  evaluatedBy: string | null;
  evaluatedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: s.id,
    eventId: s.eventId,
    teamId: s.teamId,
    activityId: s.activityId,
    score: s.score,
    evaluated: s.evaluated,
    observations: s.observations,
    evaluatedBy: s.evaluatedBy,
    evaluatedAt: s.evaluatedAt ? s.evaluatedAt.toISOString() : null,
    createdAt: s.createdAt.toISOString(),
    updatedAt: s.updatedAt.toISOString(),
  };
}

export async function getScoreMatrix(eventId: string) {
  const event = await prisma.event.findUnique({ where: { id: eventId } });
  if (!event) throw ApiError.notFound("Evento no encontrado");

  const [activities, teams, scores] = await Promise.all([
    prisma.activity.findMany({ where: { eventId }, orderBy: activityOrder }),
    prisma.team.findMany({
      where: { eventId },
      orderBy: { name: "asc" },
      select: { id: true, name: true, username: true, active: true },
    }),
    prisma.teamActivityScore.findMany({ where: { eventId } }),
  ]);

  return {
    event: {
      id: event.id,
      name: event.name,
      status: event.status,
      rankingPublished: event.rankingPublished,
    },
    activities,
    teams,
    scores: scores.map(serializeScore),
  };
}

/**
 * Crea o actualiza el resultado vigente (unico) de un equipo en una actividad.
 * El servidor nunca confia en el puntaje del cliente: valida evento, equipo,
 * no-negatividad y el tope `maxScore` (salvo permiso explicito).
 */
export async function upsertScore(
  data: {
    eventId: string;
    teamId: string;
    activityId: string;
    evaluated: boolean;
    score?: number | null;
    observations?: string | null;
  },
  actorId: string
) {
  const activity = await prisma.activity.findUnique({
    where: { id: data.activityId },
  });
  if (!activity) throw ApiError.notFound("Actividad no encontrada");
  if (activity.eventId !== data.eventId) {
    throw ApiError.badRequest("La actividad no pertenece al evento");
  }

  const team = await prisma.team.findUnique({ where: { id: data.teamId } });
  if (!team) throw ApiError.notFound("Equipo no encontrado");
  if (team.eventId !== data.eventId) {
    throw ApiError.badRequest("El equipo no pertenece al evento");
  }

  let score: number | null = null;
  if (data.evaluated) {
    if (data.score === undefined || data.score === null) {
      throw ApiError.badRequest(
        "Un resultado evaluado requiere un puntaje (puede ser 0)"
      );
    }
    if (!Number.isFinite(data.score) || data.score < 0) {
      throw ApiError.badRequest("El puntaje debe ser un numero valido y no negativo");
    }
    if (
      activity.maxScore !== null &&
      !activity.allowMaxScoreExceeded &&
      data.score > activity.maxScore + EPSILON
    ) {
      throw ApiError.badRequest(
        `El puntaje no puede superar el maximo de la actividad (${activity.maxScore})`
      );
    }
    score = round2(data.score);
  }

  const existing = await prisma.teamActivityScore.findUnique({
    where: { teamId_activityId: { teamId: data.teamId, activityId: data.activityId } },
  });

  const user = await prisma.user.findUnique({
    where: { id: actorId },
    select: { username: true },
  });
  const evaluatedBy = data.evaluated ? (user?.username ?? actorId) : null;
  const observations =
    data.observations !== undefined ? data.observations : undefined;

  const row = await prisma.teamActivityScore.upsert({
    where: { teamId_activityId: { teamId: data.teamId, activityId: data.activityId } },
    update: {
      score,
      evaluated: data.evaluated,
      ...(observations !== undefined ? { observations } : {}),
      evaluatedBy,
      evaluatedAt: data.evaluated ? new Date() : null,
    },
    create: {
      eventId: data.eventId,
      teamId: data.teamId,
      activityId: data.activityId,
      score,
      evaluated: data.evaluated,
      observations: data.observations ?? null,
      evaluatedBy,
      evaluatedAt: data.evaluated ? new Date() : null,
    },
  });

  return { score: serializeScore(row), created: !existing };
}

export async function deleteScore(id: string) {
  const row = await prisma.teamActivityScore.findUnique({ where: { id } });
  if (!row) throw ApiError.notFound("Resultado no encontrado");
  await prisma.teamActivityScore.delete({ where: { id } });
  return serializeScore(row);
}

// ---------------------------------------------------------------------------
// Puntuacion automatica de las actividades STATIONS (recorrido de postas QR)
// ---------------------------------------------------------------------------

// Marca de los puntajes calculados por el sistema. Un puntaje editado a mano
// por un admin (evaluatedBy con un username) nunca se pisa.
export const SYSTEM_EVALUATOR = "sistema";

/**
 * Recalcula y persiste el puntaje de las actividades `STATIONS` del evento para
 * un equipo. Cada posta resuelta aporta `maxScore / totalPostas`; una posta
 * saltada (frase de rescate) aporta la mitad. El resultado queda "evaluado" por
 * el sistema, salvo que un admin lo haya cargado a mano (no se sobrescribe).
 * Es idempotente y seguro de llamar tras cada visita/salto/reset.
 */
export async function recomputeStationsScoreForTeam(teamId: string): Promise<void> {
  const team = await prisma.team.findUnique({
    where: { id: teamId },
    select: {
      eventId: true,
      routeStops: { select: { stationId: true } },
      visits: { select: { stationId: true, status: true } },
    },
  });
  if (!team) return;

  const totalStops = team.routeStops.length;
  if (totalStops === 0) return;

  const activities = await prisma.activity.findMany({
    where: { eventId: team.eventId, active: true, scoringMethod: "STATIONS" },
  });
  if (activities.length === 0) return;

  const validStations = new Set(
    team.visits.filter((v) => v.status === "VALID").map((v) => v.stationId)
  );
  const resolvedStations = new Set(
    team.visits
      .filter((v) => v.status === "VALID" || v.status === "SKIPPED")
      .map((v) => v.stationId)
  );

  let validCount = 0;
  let skippedCount = 0;
  for (const stop of team.routeStops) {
    if (!resolvedStations.has(stop.stationId)) continue;
    if (validStations.has(stop.stationId)) validCount++;
    else skippedCount++;
  }

  const observations = `${validCount} superada(s), ${skippedCount} saltada(s) de ${totalStops}`;

  for (const activity of activities) {
    // Sin tope configurado no hay base de puntos para repartir.
    if (activity.maxScore === null) continue;

    const existing = await prisma.teamActivityScore.findUnique({
      where: { teamId_activityId: { teamId, activityId: activity.id } },
      select: { evaluated: true, evaluatedBy: true },
    });
    if (
      existing?.evaluated &&
      existing.evaluatedBy &&
      existing.evaluatedBy !== SYSTEM_EVALUATOR
    ) {
      continue;
    }

    const perStop = activity.maxScore / totalStops;
    let score = round2((validCount + 0.5 * skippedCount) * perStop);
    if (score > activity.maxScore + EPSILON) score = round2(activity.maxScore);

    const data = {
      score,
      evaluated: true,
      evaluatedBy: SYSTEM_EVALUATOR,
      evaluatedAt: new Date(),
      observations,
    };

    await prisma.teamActivityScore.upsert({
      where: { teamId_activityId: { teamId, activityId: activity.id } },
      update: data,
      create: {
        eventId: team.eventId,
        teamId,
        activityId: activity.id,
        ...data,
      },
    });
  }
}

// ---------------------------------------------------------------------------
// Ranking
// ---------------------------------------------------------------------------

export type RankingTeam = {
  teamId: string;
  team: string;
  active: boolean;
  total: number;
  evaluatedCount: number;
  pendingCount: number;
  activitiesCount: number;
  percent: number;
  complete: boolean;
  position: number;
  status: "PENDIENTE" | "EN_EVALUACION" | "COMPLETO" | "INACTIVO";
};

/**
 * Calcula el ranking del evento a partir de la base de datos (nunca de totales
 * enviados por el cliente). El puntaje total suma solo las actividades
 * evaluadas; una actividad pendiente NO cuenta como cero.
 *
 * Empates: ranking de competicion "1224". Dos equipos con el mismo total
 * comparten posicion y la siguiente refleja el orden competitivo. No se
 * inventan criterios secundarios de desempate (el orden alfabetico es solo
 * estable para la presentacion).
 */
export async function computeRanking(
  eventId: string,
  opts: { publicOnly: boolean } = { publicOnly: false }
) {
  const event = await prisma.event.findUnique({ where: { id: eventId } });
  if (!event) throw ApiError.notFound("Evento no encontrado");

  const activities = await prisma.activity.findMany({
    where: {
      eventId,
      active: true,
      ...(opts.publicOnly ? { published: true } : {}),
    },
    orderBy: activityOrder,
  });
  const activityIds = activities.map((a) => a.id);

  const teams = await prisma.team.findMany({
    where: { eventId },
    orderBy: { name: "asc" },
    select: { id: true, name: true, active: true },
  });

  const scores = activityIds.length
    ? await prisma.teamActivityScore.findMany({
        where: { eventId, activityId: { in: activityIds } },
      })
    : [];

  const byTeam = new Map<string, Map<string, (typeof scores)[number]>>();
  for (const score of scores) {
    if (!byTeam.has(score.teamId)) byTeam.set(score.teamId, new Map());
    byTeam.get(score.teamId)!.set(score.activityId, score);
  }

  const totalActivities = activities.length;

  const rows: RankingTeam[] = teams.map((team) => {
    const map = byTeam.get(team.id) ?? new Map();
    let sum = 0;
    let evaluatedCount = 0;
    for (const activity of activities) {
      const score = map.get(activity.id);
      if (score?.evaluated) {
        evaluatedCount++;
        sum += score.score ?? 0;
      }
    }
    const total = round2(sum);
    const pendingCount = totalActivities - evaluatedCount;
    const complete = totalActivities > 0 && evaluatedCount === totalActivities;
    const percent =
      totalActivities > 0
        ? Math.round((evaluatedCount / totalActivities) * 100)
        : 0;
    return {
      teamId: team.id,
      team: team.name,
      active: team.active,
      total,
      evaluatedCount,
      pendingCount,
      activitiesCount: totalActivities,
      percent,
      complete,
      position: 0,
      status: !team.active
        ? "INACTIVO"
        : complete
          ? "COMPLETO"
          : evaluatedCount > 0
            ? "EN_EVALUACION"
            : "PENDIENTE",
    };
  });

  rows.sort((a, b) => b.total - a.total || a.team.localeCompare(b.team, "es"));

  for (const row of rows) {
    let position = 1;
    for (const other of rows) {
      if (other.total > row.total + EPSILON) position++;
    }
    row.position = position;
  }

  return {
    event: {
      id: event.id,
      name: event.name,
      status: event.status,
      rankingPublished: event.rankingPublished,
      rankingPublishedAt: event.rankingPublishedAt
        ? event.rankingPublishedAt.toISOString()
        : null,
    },
    activities: activities.map((a) => ({
      id: a.id,
      name: a.name,
      position: a.position,
      maxScore: a.maxScore,
      status: a.status,
      scoringMethod: a.scoringMethod,
      published: a.published,
    })),
    activitiesCount: totalActivities,
    allComplete: rows.length > 0 && rows.every((r) => r.complete || !r.active),
    teams: rows,
  };
}

/** Detalle de un equipo: una fila por actividad. Las observaciones son privadas. */
export async function getTeamDetail(
  eventId: string,
  teamId: string,
  opts: { includeObservations: boolean; publicOnly: boolean }
) {
  const team = await prisma.team.findUnique({ where: { id: teamId } });
  if (!team || team.eventId !== eventId) {
    throw ApiError.notFound("Equipo no encontrado");
  }

  const [activities, scores] = await Promise.all([
    prisma.activity.findMany({
      where: {
        eventId,
        active: true,
        ...(opts.publicOnly ? { published: true } : {}),
      },
      orderBy: activityOrder,
    }),
    prisma.teamActivityScore.findMany({ where: { eventId, teamId } }),
  ]);
  const map = new Map(scores.map((s) => [s.activityId, s]));

  let total = 0;
  let evaluatedCount = 0;
  const rows = activities.map((activity) => {
    const score = map.get(activity.id);
    const evaluated = Boolean(score?.evaluated);
    const value = evaluated ? round2(score!.score ?? 0) : null;
    if (evaluated) {
      evaluatedCount++;
      total += value!;
    }
    return {
      activityId: activity.id,
      name: activity.name,
      position: activity.position,
      maxScore: activity.maxScore,
      activityStatus: activity.status,
      scored: evaluated,
      score: value,
      ...(opts.includeObservations
        ? {
            observations: score?.observations ?? null,
            evaluatedAt: score?.evaluatedAt ? score.evaluatedAt.toISOString() : null,
            evaluatedBy: score?.evaluatedBy ?? null,
          }
        : {}),
    };
  });

  return {
    team: { id: team.id, name: team.name, active: team.active },
    event: { id: eventId },
    activities: rows,
    total: round2(total),
    evaluatedCount,
    activitiesCount: activities.length,
    pendingCount: activities.length - evaluatedCount,
    complete: activities.length > 0 && evaluatedCount === activities.length,
  };
}

export async function publishRanking(eventId: string, published: boolean) {
  const event = await prisma.event.findUnique({ where: { id: eventId } });
  if (!event) throw ApiError.notFound("Evento no encontrado");
  return prisma.event.update({
    where: { id: eventId },
    data: {
      rankingPublished: published,
      rankingPublishedAt: published ? new Date() : null,
    },
  });
}

// ---------------------------------------------------------------------------
// Vista publica
// ---------------------------------------------------------------------------

export async function getPublicRanking(eventId?: string) {
  const event = eventId
    ? await prisma.event.findUnique({ where: { id: eventId } })
    : await prisma.event.findFirst({
        where: { rankingPublished: true },
        orderBy: { rankingPublishedAt: "desc" },
      });
  if (!event) throw ApiError.notFound("No hay un ranking publicado");

  if (!event.rankingPublished) {
    return {
      published: false,
      event: { id: event.id, name: event.name },
      activities: [],
      activitiesCount: 0,
      allComplete: false,
      teams: [],
    };
  }

  const ranking = await computeRanking(event.id, { publicOnly: true });
  return { published: true, ...ranking };
}

export async function getPublicTeamDetail(eventId: string, teamId: string) {
  const event = await prisma.event.findUnique({ where: { id: eventId } });
  if (!event || !event.rankingPublished) {
    throw ApiError.notFound("Ranking no disponible");
  }
  return getTeamDetail(eventId, teamId, {
    includeObservations: false,
    publicOnly: true,
  });
}

// ---------------------------------------------------------------------------
// Exportacion CSV
// ---------------------------------------------------------------------------

export async function buildScoringCsv(eventId: string): Promise<string> {
  const event = await prisma.event.findUnique({ where: { id: eventId } });
  if (!event) throw ApiError.notFound("Evento no encontrado");

  const [activities, ranking, scores] = await Promise.all([
    prisma.activity.findMany({ where: { eventId }, orderBy: activityOrder }),
    computeRanking(eventId, { publicOnly: false }),
    prisma.teamActivityScore.findMany({ where: { eventId } }),
  ]);

  const key = (teamId: string, activityId: string) => `${teamId}:${activityId}`;
  const scoreMap = new Map(
    scores.map((s) => [key(s.teamId, s.activityId), s] as const)
  );

  const header = [
    "Posicion",
    "Equipo",
    "Puntaje total",
    "Actividades evaluadas",
    "Estado",
  ];
  for (const activity of activities) {
    header.push(activity.name);
    header.push(`${activity.name} (estado)`);
  }

  const esc = (value: string | number | null) => {
    if (value === null || value === undefined) return "";
    const s = String(value);
    return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };

  const cells: (string | number | null)[][] = [header];
  for (const row of ranking.teams) {
    const line: (string | number | null)[] = [
      row.position,
      row.team,
      row.total,
      `${row.evaluatedCount}/${row.activitiesCount}`,
      row.status,
    ];
    for (const activity of activities) {
      const score = scoreMap.get(key(row.teamId, activity.id));
      if (score?.evaluated) {
        line.push(round2(score.score ?? 0), "Evaluado");
      } else {
        line.push("", "Sin evaluar");
      }
    }
    cells.push(line);
  }

  return cells.map((row) => row.map(esc).join(",")).join("\r\n");
}
