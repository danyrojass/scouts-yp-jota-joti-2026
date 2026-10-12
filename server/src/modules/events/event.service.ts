import type { EventStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ApiError } from "@/utils/errors";

const ACTIVE_STATUSES: EventStatus[] = ["PREPARED", "IN_PROGRESS"];

export function isEventActive(status: EventStatus) {
  return ACTIVE_STATUSES.includes(status);
}

export function eventInclude() {
  return {
    _count: {
      select: { teams: true, stations: true },
    },
  } as const;
}

async function assertSingleActiveEvent(
  status: EventStatus,
  excludeId?: string
) {
  if (!isEventActive(status)) return;
  const existing = await prisma.event.findFirst({
    where: {
      id: { not: excludeId },
      status: { in: ACTIVE_STATUSES },
    },
    select: { id: true },
  });
  if (existing) {
    throw ApiError.conflict(
      "Ya existe un evento activo (Preparado o En curso). Finaliza o cancela el anterior para continuar."
    );
  }
}

async function assertNoOtherActive(excludeId?: string) {
  const existing = await prisma.event.findFirst({
    where: {
      id: { not: excludeId },
      status: { in: ACTIVE_STATUSES },
    },
    select: { id: true },
  });
  if (existing) {
    throw ApiError.conflict(
      "Ya existe un evento activo (Preparado o En curso). Finaliza o cancela el anterior para continuar."
    );
  }
}

export async function listEvents() {
  return prisma.event.findMany({
    orderBy: { date: "desc" },
    include: {
      _count: { select: { teams: true, stations: true, visits: true } },
    },
  });
}

export async function getEventById(id: string, includeAll = false) {
  const event = await prisma.event.findUnique({
    where: { id },
    include: {
      _count: { select: { teams: true, stations: true, visits: true } },
      ...(includeAll
        ? {
            teams: {
              orderBy: { name: "asc" },
              select: {
                id: true,
                name: true,
                username: true,
                active: true,
                _count: { select: { visits: true } },
                routeStops: { select: { position: true, stationId: true, question: true, questionAnswer: true } },
              },
            },
            stations: {
              orderBy: { name: "asc" },
              select: {
                id: true,
                name: true,
                publicToken: true,
                challengeType: true,
                active: true,
                _count: { select: { visits: true } },
              },
            },
          }
        : {}),
    },
  });
  if (!event) throw ApiError.notFound("Evento no encontrado");
  return event;
}

export async function createEvent(data: {
  name: string;
  description?: string | null;
  date: Date;
  location?: string | null;
  status: EventStatus;
}) {
  await assertSingleActiveEvent(data.status);
  const event = await prisma.event.create({
    data: {
      name: data.name,
      description: data.description,
      date: data.date,
      location: data.location,
      status: data.status,
    },
  });
  return event;
}

export async function updateEvent(
  id: string,
  data: Partial<{
    name: string;
    description: string | null;
    date: Date;
    location: string | null;
    status: EventStatus;
  }>
) {
  const current = await prisma.event.findUnique({ where: { id } });

  const incoming: Partial<{
    name: string;
    description: string | null;
    date: Date;
    location: string | null;
    status: EventStatus;
  }> = {};

  incoming.name = data.name ?? current!.name;
  incoming.description = data.description !== undefined ? data.description : current!.description;
  incoming.date = data.date ?? current!.date;
  incoming.location = data.location !== undefined ? data.location : current!.location;
  incoming.status = data.status ?? current!.status;

  const effectiveStatus = incoming.status!;
  if (effectiveStatus !== current!.status) {
    await validateTransition(current!.status, effectiveStatus, id);
  } else if (current!.status === "IN_PROGRESS") {
    if (data.status === undefined) {
      throw ApiError.forbidden(
        "No se pueden editar los datos mientras el evento esta en curso"
      );
    }
  }

  if (isEventActive(effectiveStatus)) {
    await assertNoOtherActive(id);
  }

  return prisma.event.update({
    where: { id },
    data: {
      name: incoming.name!,
      description: incoming.description ?? null,
      date: incoming.date!,
      location: incoming.location ?? null,
      status: effectiveStatus,
    },
  });
}

const TRANSITIONS: Record<EventStatus, EventStatus[]> = {
  PREPARED: ["IN_PROGRESS", "CANCELLED"],
  IN_PROGRESS: ["FINISHED", "CANCELLED"],
  FINISHED: [],
  CANCELLED: [],
};

async function validateTransition(
  from: EventStatus,
  to: EventStatus,
  eventId: string
) {
  if (from === to) return;
  if (!TRANSITIONS[from].includes(to)) {
    throw ApiError.conflict(
      `Transicion invalida de estado: ${from} -> ${to}`
    );
  }
  if (to === "IN_PROGRESS") {
    await validateReadyToStart(eventId);
  }
}

/** The event must have stations and every active team a configured itinerary. */
export async function validateReadyToStart(eventId: string) {
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    include: {
      stations: true,
      teams: { include: { routeStops: true } },
    },
  });
  if (!event) throw ApiError.notFound("Evento no encontrado");

  if (event.stations.length < 2) {
    throw ApiError.conflict(
      "El evento necesita al menos 2 postas para comenzar"
    );
  }

  const activeTeams = event.teams.filter((t) => t.active);
  if (activeTeams.length === 0) {
    throw ApiError.conflict(
      "El evento necesita al menos un equipo activo para comenzar"
    );
  }

  const stationsById = new Map(event.stations.map((s) => [s.id, s]));
  for (const team of activeTeams) {
    const stops = [...team.routeStops].sort((a, b) => a.position - b.position);
    if (stops.length < 2) {
      throw ApiError.conflict(
        `El equipo "${team.name}" necesita un itinerario con al menos 2 postas`
      );
    }
    const missing = stops.filter((s) => !stationsById.has(s.stationId));
    if (missing.length > 0) {
      throw ApiError.conflict(
        `El itinerario del equipo "${team.name}" incluye postas inexistentes`
      );
    }
  }
}

export async function transitionEvent(id: string, to: EventStatus) {
  const current = await prisma.event.findUnique({ where: { id } });
  if (!current) throw ApiError.notFound("Evento no encontrado");
  if (current.status === to) return current;
  await validateTransition(current.status, to, id);
  return prisma.event.update({ where: { id }, data: { status: to } });
}

export async function deleteEvent(id: string) {
  const event = await prisma.event.findUnique({ where: { id } });
  if (!event) throw ApiError.notFound("Evento no encontrado");
  if (event.status === "IN_PROGRESS") {
    throw ApiError.forbidden("No se puede eliminar un evento en curso");
  }
  await prisma.event.delete({ where: { id } });
}