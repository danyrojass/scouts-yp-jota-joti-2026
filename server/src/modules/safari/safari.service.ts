import { prisma } from "@/lib/prisma";
import { ApiError } from "@/utils/errors";

const itemOrder = [{ position: "asc" as const }, { createdAt: "asc" as const }];

export type TeamSafariItem = {
  id: string;
  name: string;
  description: string | null;
  position: number;
  found: boolean;
  foundAt: string | null;
};

/** Safari checklist for the authenticated team (active items only). */
export async function getTeamSafari(teamId: string) {
  const team = await prisma.team.findUnique({
    where: { id: teamId },
    include: { event: { select: { id: true, name: true, status: true } } },
  });
  if (!team) throw ApiError.unauthorized("Sesion de equipo invalida");

  const safari = await prisma.safari.findUnique({
    where: { eventId: team.eventId },
    include: { items: { where: { active: true }, orderBy: itemOrder } },
  });

  let items: TeamSafariItem[] = [];
  if (safari) {
    const finds = await prisma.safariFind.findMany({
      where: { teamId, itemId: { in: safari.items.map((i) => i.id) } },
    });
    const foundMap = new Map(finds.map((f) => [f.itemId, f.foundAt] as const));
    items = safari.items.map((item) => ({
      id: item.id,
      name: item.name,
      description: item.description,
      position: item.position,
      found: foundMap.has(item.id),
      foundAt: foundMap.get(item.id)?.toISOString() ?? null,
    }));
  }

  const found = items.filter((i) => i.found).length;
  const total = items.length;

  return {
    team: { id: team.id, name: team.name },
    event: { id: team.event.id, name: team.event.name, status: team.event.status },
    safari: safari
      ? {
          id: safari.id,
          title: safari.title,
          description: safari.description,
          active: safari.active,
        }
      : null,
    items,
    progress: {
      total,
      found,
      done: total > 0 && found >= total,
      percent: total > 0 ? Math.round((found / total) * 100) : 0,
    },
  };
}

/**
 * Marks (or unmarks) an item as found for the team. Idempotent: the unique
 * (itemId, teamId) pair guarantees a single find even under concurrency.
 */
export async function setSafariItemFound(
  teamId: string,
  itemId: string,
  found: boolean
) {
  const team = await prisma.team.findUnique({
    where: { id: teamId },
    include: { event: { select: { id: true, status: true } } },
  });
  if (!team) throw ApiError.unauthorized("Sesion de equipo invalida");

  const item = await prisma.safariItem.findUnique({
    where: { id: itemId },
    include: { safari: { select: { eventId: true, active: true } } },
  });
  if (!item) throw ApiError.notFound("Elemento del safari no encontrado");
  if (item.safari.eventId !== team.eventId) {
    throw ApiError.forbidden("Este safari no pertenece a tu evento");
  }

  if (team.event.status !== "IN_PROGRESS") {
    throw ApiError.conflict("El evento no esta en curso");
  }

  if (found) {
    if (!item.safari.active) throw ApiError.conflict("El safari no esta activo");
    if (!item.active) throw ApiError.conflict("Este elemento no esta activo");
    await prisma.safariFind.upsert({
      where: { itemId_teamId: { itemId, teamId } },
      update: {},
      create: { safariId: item.safariId, itemId, teamId, eventId: team.eventId },
    });
  } else {
    await prisma.safariFind.deleteMany({ where: { itemId, teamId } });
  }

  return getTeamSafari(teamId);
}

// ---------------------------------------------------------------------------
// Admin
// ---------------------------------------------------------------------------

export async function getAdminSafari(eventId: string) {
  const event = await prisma.event.findUnique({ where: { id: eventId } });
  if (!event) throw ApiError.notFound("Evento no encontrado");

  const safari = await prisma.safari.findUnique({
    where: { eventId },
    include: { items: { orderBy: itemOrder } },
  });
  return { safari };
}

export async function createSafari(
  eventId: string,
  data: { title?: string; description?: string | null }
) {
  const event = await prisma.event.findUnique({ where: { id: eventId } });
  if (!event) throw ApiError.notFound("Evento no encontrado");

  const existing = await prisma.safari.findUnique({ where: { eventId } });
  if (existing) throw ApiError.conflict("Este evento ya tiene un safari");

  return prisma.safari.create({
    data: {
      eventId,
      title: data.title?.trim() || undefined,
      description: data.description ?? null,
    },
    include: { items: true },
  });
}

export async function getSafariWithItems(safariId: string) {
  const safari = await prisma.safari.findUnique({
    where: { id: safariId },
    include: { items: { orderBy: itemOrder } },
  });
  if (!safari) throw ApiError.notFound("Safari no encontrado");
  return { safari };
}

export async function updateSafari(
  safariId: string,
  data: { title?: string; description?: string | null; active?: boolean }
) {
  const safari = await prisma.safari.findUnique({ where: { id: safariId } });
  if (!safari) throw ApiError.notFound("Safari no encontrado");
  return prisma.safari.update({
    where: { id: safariId },
    data: {
      title: data.title ?? undefined,
      description: data.description !== undefined ? data.description : undefined,
      active: data.active ?? undefined,
    },
  });
}

export async function createSafariItem(
  safariId: string,
  data: {
    name: string;
    description?: string | null;
    position?: number;
    active?: boolean;
  }
) {
  const safari = await prisma.safari.findUnique({ where: { id: safariId } });
  if (!safari) throw ApiError.notFound("Safari no encontrado");

  let position = data.position;
  if (position === undefined) {
    const last = await prisma.safariItem.findFirst({
      where: { safariId },
      orderBy: { position: "desc" },
    });
    position = (last?.position ?? 0) + 1;
  }

  return prisma.safariItem.create({
    data: {
      safariId,
      name: data.name,
      description: data.description ?? null,
      position,
      active: data.active ?? true,
    },
  });
}

export async function updateSafariItem(
  itemId: string,
  data: {
    name?: string;
    description?: string | null;
    position?: number;
    active?: boolean;
  }
) {
  const item = await prisma.safariItem.findUnique({ where: { id: itemId } });
  if (!item) throw ApiError.notFound("Elemento no encontrado");
  return prisma.safariItem.update({
    where: { id: itemId },
    data: {
      name: data.name ?? undefined,
      description: data.description !== undefined ? data.description : undefined,
      position: data.position ?? undefined,
      active: data.active ?? undefined,
    },
  });
}

export async function deleteSafariItem(itemId: string) {
  const item = await prisma.safariItem.findUnique({ where: { id: itemId } });
  if (!item) throw ApiError.notFound("Elemento no encontrado");
  await prisma.safariItem.delete({ where: { id: itemId } });
}

/** Reorders every item of the safari; the list must contain all items exactly. */
export async function reorderSafariItems(safariId: string, itemIds: string[]) {
  const items = await prisma.safariItem.findMany({
    where: { safariId },
    select: { id: true },
  });
  const ids = new Set(items.map((i) => i.id));
  if (
    itemIds.length !== items.length ||
    itemIds.some((id) => !ids.has(id)) ||
    new Set(itemIds).size !== itemIds.length
  ) {
    throw ApiError.badRequest(
      "La lista debe incluir todos los elementos del safari sin repetir"
    );
  }

  await prisma.$transaction(
    itemIds.map((id, index) =>
      prisma.safariItem.update({
        where: { id },
        data: { position: index + 1 },
      })
    )
  );
}

export async function getSafariProgress(safariId: string) {
  const safari = await prisma.safari.findUnique({ where: { id: safariId } });
  if (!safari) throw ApiError.notFound("Safari no encontrado");

  const items = await prisma.safariItem.findMany({
    where: { safariId },
    orderBy: itemOrder,
  });
  const activeItems = items.filter((i) => i.active);
  const activeIds = new Set(activeItems.map((i) => i.id));

  const [teams, finds] = await Promise.all([
    prisma.team.findMany({
      where: { eventId: safari.eventId },
      orderBy: { name: "asc" },
      select: { id: true, name: true, active: true },
    }),
    prisma.safariFind.findMany({ where: { safariId } }),
  ]);

  const foundByTeam = new Map<string, Set<string>>();
  for (const f of finds) {
    if (!foundByTeam.has(f.teamId)) foundByTeam.set(f.teamId, new Set());
    foundByTeam.get(f.teamId)!.add(f.itemId);
  }

  const total = activeItems.length;
  const teamRows = teams.map((team) => {
    const set = foundByTeam.get(team.id) ?? new Set<string>();
    const found = [...set].filter((id) => activeIds.has(id)).length;
    return {
      teamId: team.id,
      team: team.name,
      active: team.active,
      found,
      total,
      done: total > 0 && found >= total,
      percent: total > 0 ? Math.round((found / total) * 100) : 0,
    };
  });

  const itemRows = items
    .map((item) => ({
      id: item.id,
      name: item.name,
      position: item.position,
      active: item.active,
      teams: finds.filter((f) => f.itemId === item.id).length,
    }))
    .sort((a, b) => b.teams - a.teams);

  return {
    safari: {
      id: safari.id,
      title: safari.title,
      description: safari.description,
      active: safari.active,
    },
    counts: {
      items: items.length,
      activeItems: activeItems.length,
      teams: teams.length,
      teamsCompleted: teamRows.filter((r) => r.done).length,
    },
    teams: teamRows,
    items: itemRows,
  };
}

/** Clears safari finds for the whole event or a single team. */
export async function resetSafariProgress(eventId: string, teamId?: string) {
  const safari = await prisma.safari.findUnique({ where: { eventId } });
  if (!safari) throw ApiError.notFound("Safari no encontrado");

  if (teamId) {
    const team = await prisma.team.findUnique({ where: { id: teamId } });
    if (!team || team.eventId !== eventId) {
      throw ApiError.badRequest("El equipo no pertenece al evento");
    }
  }

  const deleted = await prisma.safariFind.deleteMany({
    where: { safariId: safari.id, ...(teamId ? { teamId } : {}) },
  });
  return { deleted: deleted.count, safariId: safari.id };
}
