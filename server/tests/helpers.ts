import request from "supertest";
import type { Express } from "express";
import { prisma } from "@/lib/prisma";
import { createApp } from "@/app";
import { hashPassword } from "@/modules/auth/auth.service";

export type App = Express;
export type Agent = ReturnType<typeof request.agent>;

export { request, createApp };

export type SessionAgent = {
  agent: Agent;
  csrfToken: string;
};

export async function loginAs(
  app: App,
  username: string,
  password: string
): Promise<SessionAgent> {
  const agent = request.agent(app);
  const res = await agent
    .post("/api/v1/auth/login")
    .send({ username, password });
  if (res.status !== 200) {
    throw new Error(`login falló para ${username}: ${res.body.error?.message ?? res.status}`);
  }
  const csrfToken: string = res.body.csrfToken ?? "";
  if (!csrfToken) {
    const csrfRes = await agent.get("/api/v1/auth/csrf");
    return { agent, csrfToken: (csrfRes.body as { csrfToken: string }).csrfToken };
  }
  return { agent, csrfToken };
}

export async function createAdmin(username = "root", password = "s3cret-admin") {
  return prisma.user.create({
    data: { username, passwordHash: await hashPassword(password), role: "ADMIN" },
  });
}

export type Fixture = {
  eventId: string;
  stations: { id: string; token: string; name: string; challengeType: string; expectedAnswer: string | null }[];
  teams: { id: string; name: string; username: string; password: string; route: string[] }[];
};

/**
 * Creates an event with the given station templates (by challenge type) and
 * teams. The first station of every team route is a CODE station.
 */
export async function seedFixture(teamsSeed: {
  name: string;
  username: string;
  order: number[];
}[]): Promise<Fixture> {
  const event = await prisma.event.create({
    data: { name: "Evento de prueba", date: new Date("2026-12-01"), status: "PREPARED" },
  });

  const stationDefs = [
    { name: "Posta Alpha", type: "CODE", answer: "tacuru", instructions: "Escribi la clave" },
    { name: "Posta Beta", type: "QUESTION", answer: "siete", instructions: "Cuantas son?" },
    { name: "Posta Gamma", type: "CONFIRMATION", answer: null, instructions: "Confirmá tu paso" },
    { name: "Posta Delta", type: "AUTO", answer: "clave-delta", instructions: "Respondé lo que veas" },
  ];

  const stations: Fixture["stations"] = [];
  for (const [i, def] of stationDefs.entries()) {
    const station = await prisma.station.create({
      data: {
        eventId: event.id,
        name: def.name,
        publicToken: `token-station-${i + 1}-${Math.random().toString(36).slice(2, 10)}`,
        challengeType: def.type as never,
        instructions: def.instructions,
        expectedAnswer: def.answer,
        autoAcceptAny: false,
      },
    });
    stations.push({
      id: station.id,
      token: station.publicToken,
      name: def.name,
      challengeType: def.type,
      expectedAnswer: def.answer,
    });
  }

  const teams: Fixture["teams"] = [];
  for (const t of teamsSeed) {
    const team = await prisma.team.create({
      data: {
        eventId: event.id,
        name: t.name,
        username: t.username,
        passwordHash: await hashPassword("equipo-pass-123"),
      },
    });
    await prisma.routeStop.createMany({
      data: t.order.map((stationIndex, pos) => ({
        teamId: team.id,
        stationId: stations[stationIndex].id,
        position: pos + 1,
      })),
    });
    teams.push({
      id: team.id,
      name: t.name,
      username: t.username,
      password: "equipo-pass-123",
      route: t.order.map((i) => stations[i].id),
    });
  }

  return { eventId: event.id, stations, teams };
}

export async function startEvent(eventId: string) {
  return prisma.event.update({ where: { id: eventId }, data: { status: "IN_PROGRESS" } });
}

export async function setEventStatus(eventId: string, status: string) {
  return prisma.event.update({
    where: { id: eventId },
    data: { status: status as never },
  });
}

/** Adds a team with a route (ordered station ids) to an existing event. */
export async function addTeam(
  eventId: string,
  username: string,
  name: string,
  stationIds: string[],
  password = "equipo-pass-123"
) {
  const team = await prisma.team.create({
    data: { eventId, name, username, passwordHash: await hashPassword(password) },
  });
  await prisma.routeStop.createMany({
    data: stationIds.map((stationId, i) => ({
      teamId: team.id,
      stationId,
      position: i + 1,
    })),
  });
  return { id: team.id, username, name, password };
}