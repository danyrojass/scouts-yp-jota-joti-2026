import { beforeAll, describe, expect, it } from "vitest";
import {
  addTeam,
  createAdmin,
  createApp,
  loginAs,
  request,
  seedFixture,
  type Fixture,
} from "./helpers";
import { prisma } from "@/lib/prisma";

const app = createApp();
let fx: Fixture;

beforeAll(async () => {
  await createAdmin("root", "s3cret-admin");
  fx = await seedFixture([]);
  await addTeam(fx.eventId, "estado-a", "Estado A", [fx.stations[0].id, fx.stations[1].id]);
});

function post(
  agent: ReturnType<typeof request.agent>,
  csrfToken: string,
  publicToken: string,
  answer: string
) {
  return agent
    .post("/api/v1/visits")
    .set("x-csrf-token", csrfToken)
    .send({ publicToken, answer });
}

describe("Restricciones por estado del evento", () => {
  it("no permite visitas mientras el evento está PREPARED", async () => {
    const team = await loginAs(app, "estado-a", "equipo-pass-123");
    const res = await post(team.agent, team.csrfToken, fx.stations[0].token, "tacuru");
    expect(res.body.result).toBe("EVENT_NOT_READY");

    const admin = await loginAs(app, "root", "s3cret-admin");
    const started = await admin.agent
      .post(`/api/v1/events/${fx.eventId}/start`)
      .set("x-csrf-token", admin.csrfToken);
    expect(started.status).toBe(200);
    expect(started.body.event.status).toBe("IN_PROGRESS");
  });

  it("permite visitas con el evento IN_PROGRESS y las bloquea al FINISHED", async () => {
    const team = await loginAs(app, "estado-a", "equipo-pass-123");
    const ok = await post(team.agent, team.csrfToken, fx.stations[0].token, "tacuru");
    expect(ok.body.result).toBe("VALID");

    const admin = await loginAs(app, "root", "s3cret-admin");
    const finished = await admin.agent
      .post(`/api/v1/events/${fx.eventId}/finish`)
      .set("x-csrf-token", admin.csrfToken);
    expect(finished.status).toBe(200);

    const after = await post(team.agent, team.csrfToken, fx.stations[1].token, "siete");
    expect(after.body.result).toBe("EVENT_FINISHED");
  });

  it("rechaza transiciones de estado inválidas", async () => {
    const admin = await loginAs(app, "root", "s3cret-admin");
    // FINISHED -> IN_PROGRESS no está permitido.
    const res = await admin.agent
      .post(`/api/v1/events/${fx.eventId}/start`)
      .set("x-csrf-token", admin.csrfToken);
    expect(res.status).toBe(409);
  });

  it("bloquea la edición de datos con el evento en curso", async () => {
    const event = await prisma.event.create({
      data: { name: "En curso", date: new Date("2026-12-02"), status: "IN_PROGRESS" },
    });
    await prisma.station.createMany({
      data: [
        { eventId: event.id, name: "S1", publicToken: "tok-" + Math.random().toString(36).slice(2), challengeType: "CODE", expectedAnswer: "a" },
        { eventId: event.id, name: "S2", publicToken: "tok-" + Math.random().toString(36).slice(2), challengeType: "CODE", expectedAnswer: "b" },
      ],
    });
    const admin = await loginAs(app, "root", "s3cret-admin");
    const res = await admin.agent
      .patch(`/api/v1/events/${event.id}`)
      .set("x-csrf-token", admin.csrfToken)
      .send({ name: "Cambiado" });
    expect(res.status).toBe(403);
  });

  it("no permite iniciar un evento sin postas o itinerarios suficientes", async () => {
    const admin = await loginAs(app, "root", "s3cret-admin");
    const thin = await prisma.event.create({
      data: { name: "Falta config", date: new Date("2026-12-03"), status: "PREPARED" },
    });
    await prisma.station.create({
      data: { eventId: thin.id, name: "Solo una", publicToken: "tok-" + Math.random().toString(36).slice(2), challengeType: "CODE", expectedAnswer: "a" },
    });
    const res = await admin.agent
      .post(`/api/v1/events/${thin.id}/start`)
      .set("x-csrf-token", admin.csrfToken);
    expect(res.status).toBe(409);
  });

  it("permite cancelar un evento PREPARED y bloquea las visitas", async () => {
    const event = await prisma.event.create({
      data: { name: "A cancelar", date: new Date("2026-12-04"), status: "PREPARED" },
    });
    const s1 = await prisma.station.create({ data: { eventId: event.id, name: "C1", publicToken: "tok-" + Math.random().toString(36).slice(2), challengeType: "CODE", expectedAnswer: "x" } });
    const s2 = await prisma.station.create({ data: { eventId: event.id, name: "C2", publicToken: "tok-" + Math.random().toString(36).slice(2), challengeType: "CODE", expectedAnswer: "y" } });
    await addTeam(event.id, "estado-cancel", "Estado Cancel", [s1.id, s2.id]);

    const admin = await loginAs(app, "root", "s3cret-admin");
    const cancelled = await admin.agent
      .post(`/api/v1/events/${event.id}/cancel`)
      .set("x-csrf-token", admin.csrfToken);
    expect(cancelled.status).toBe(200);
    expect(cancelled.body.event.status).toBe("CANCELLED");

    const team = await loginAs(app, "estado-cancel", "equipo-pass-123");
    const res = await post(team.agent, team.csrfToken, s1.publicToken, "x");
    expect(res.body.result).toBe("EVENT_CANCELLED");
  });
});