import { Prisma, type MemberRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ApiError } from "@/utils/errors";

const clean = (value?: string | null) => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
};

const parseBirthDate = (value?: string | null): Date | null => {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  const date = new Date(trimmed);
  return Number.isNaN(date.getTime()) ? null : date;
};

const documentTakenError = (document: string) =>
  ApiError.conflict(`Ya hay un integrante con el documento "${document}" en este evento.`);

const duplicateDocument = (err: unknown) =>
  err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002";

async function assertTeamInEvent(teamId: string, eventId: string) {
  const team = await prisma.team.findUnique({ where: { id: teamId } });
  if (!team) throw ApiError.badRequest("El equipo indicado no existe");
  if (team.eventId !== eventId) {
    throw ApiError.badRequest("El equipo no pertenece al evento indicado");
  }
}

export async function listMembers(eventId: string) {
  const event = await prisma.event.findUnique({ where: { id: eventId } });
  if (!event) throw ApiError.notFound("Evento no encontrado");
  return prisma.member.findMany({
    where: { eventId },
    orderBy: [
      { active: "desc" },
      { lastName: "asc" },
      { firstName: "asc" },
    ],
    include: { team: { select: { id: true, name: true } } },
  });
}

type MemberInput = {
  eventId: string;
  teamId?: string | null;
  firstName: string;
  lastName: string;
  document?: string | null;
  birthDate?: string | null;
  role?: MemberRole;
  phone?: string | null;
  notes?: string | null;
  active?: boolean;
};

export async function createMember(data: MemberInput) {
  const event = await prisma.event.findUnique({ where: { id: data.eventId } });
  if (!event) throw ApiError.notFound("Evento no encontrado");
  const teamId = clean(data.teamId);
  if (teamId) await assertTeamInEvent(teamId, data.eventId);

  try {
    return await prisma.member.create({
      data: {
        eventId: data.eventId,
        teamId,
        firstName: data.firstName.trim(),
        lastName: data.lastName.trim(),
        document: clean(data.document),
        birthDate: parseBirthDate(data.birthDate),
        role: data.role ?? "SCOUT",
        phone: clean(data.phone),
        notes: clean(data.notes),
        active: data.active ?? true,
      },
      include: { team: { select: { id: true, name: true } } },
    });
  } catch (err) {
    if (duplicateDocument(err)) throw documentTakenError(data.document ?? "");
    throw err;
  }
}

type MemberUpdate = {
  teamId?: string | null;
  firstName?: string;
  lastName?: string;
  document?: string | null;
  birthDate?: string | null;
  role?: MemberRole;
  phone?: string | null;
  notes?: string | null;
  active?: boolean;
};

export async function updateMember(id: string, data: MemberUpdate) {
  const member = await prisma.member.findUnique({ where: { id } });
  if (!member) throw ApiError.notFound("Integrante no encontrado");

  if (data.teamId !== undefined && data.teamId !== null) {
    await assertTeamInEvent(data.teamId, member.eventId);
  }

  try {
    return await prisma.member.update({
      where: { id },
      data: {
        teamId: data.teamId !== undefined ? clean(data.teamId) : undefined,
        firstName: data.firstName?.trim(),
        lastName: data.lastName?.trim(),
        document: data.document !== undefined ? clean(data.document) : undefined,
        birthDate: data.birthDate !== undefined ? parseBirthDate(data.birthDate) : undefined,
        role: data.role,
        phone: data.phone !== undefined ? clean(data.phone) : undefined,
        notes: data.notes !== undefined ? clean(data.notes) : undefined,
        active: data.active,
      },
      include: { team: { select: { id: true, name: true } } },
    });
  } catch (err) {
    if (duplicateDocument(err)) throw documentTakenError(data.document ?? "");
    throw err;
  }
}

export async function deleteMember(id: string) {
  const member = await prisma.member.findUnique({ where: { id } });
  if (!member) throw ApiError.notFound("Integrante no encontrado");
  await prisma.member.delete({ where: { id } });
  return member;
}
