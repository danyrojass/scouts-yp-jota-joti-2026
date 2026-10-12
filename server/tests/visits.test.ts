import { beforeAll, describe, expect, it } from "vitest";
import {
  addTeam,
  createApp,
  loginAs,
  request,
  seedFixture,
  startEvent,
  type Fixture,
} from "./helpers";
import { prisma } from "@/lib/prisma";

const app = createApp();
let fx: Fixture;

beforeAll(async () => {
  fx = await seedFixture([]);
  await startEvent(fx.eventId);
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

describe("Registro de visitas", () => {
  it("registra una visita válida con la respuesta correcta (ignora mayúsculas y tildes)", async () => {
    await addTeam(fx.eventId, "v-ok", "OK", [fx.stations[0].id, fx.stations[1].id]);
    const { agent, csrfToken } = await loginAs(app, "v-ok", "equipo-pass-123");

    const res = await post(agent, csrfToken, fx.stations[0].token, "  TaCurú ");
    expect(res.status).toBe(200);
    expect(res.body.result).toBe("VALID");
    expect(res.body.remaining).toBe(1);
    expect(res.body.nextStation.id).toBe(fx.stations[1].id);

    const passport = await agent.get("/api/v1/passport");
    expect(passport.body.progress.completed).toBe(1);
  });

  it("rechaza una respuesta incorrecta y registra el intento", async () => {
    await addTeam(fx.eventId, "v-bad", "Bad", [fx.stations[0].id, fx.stations[1].id]);
    const { agent, csrfToken } = await loginAs(app, "v-bad", "equipo-pass-123");

    const res = await post(agent, csrfToken, fx.stations[0].token, "respuesta-mala");
    expect(res.status).toBe(200);
    expect(res.body.result).toBe("INCORRECT");
    expect(res.body.attemptNumber).toBe(1);

    const team = await prisma.team.findFirstOrThrow({ where: { username: "v-bad" } });
    const visits = await prisma.stationVisit.findMany({ where: { teamId: team.id } });
    expect(visits).toHaveLength(1);
    expect(visits[0].status).toBe("INCORRECT");
    expect(visits[0].validKey).toBeNull();

    // The incorrect attempt does not advance progress.
    const passport = await agent.get("/api/v1/passport");
    expect(passport.body.progress.completed).toBe(0);
    expect(passport.body.history[0].status).toBe("INCORRECT");
  });

  it("rechaza una posta fuera de orden", async () => {
    await addTeam(fx.eventId, "v-order", "Order", [fx.stations[0].id, fx.stations[1].id]);
    const { agent, csrfToken } = await loginAs(app, "v-order", "equipo-pass-123");

    const peek = await agent.get(`/api/v1/visits/posta/${fx.stations[1].token}`);
    expect(peek.body.status).toBe("NOT_YOUR_NEXT");

    const res = await post(agent, csrfToken, fx.stations[1].token, "siete");
    expect(res.body.result).toBe("NOT_YOUR_NEXT");
    const visits = await prisma.stationVisit.count({ where: { status: "VALID" } });
    void visits;
  });

  it("rechaza visitas duplicadas a la misma posta", async () => {
    await addTeam(fx.eventId, "v-dup", "Dup", [fx.stations[0].id, fx.stations[1].id]);
    const { agent, csrfToken } = await loginAs(app, "v-dup", "equipo-pass-123");

    const first = await post(agent, csrfToken, fx.stations[0].token, "tacuru");
    expect(first.body.result).toBe("VALID");
    const second = await post(agent, csrfToken, fx.stations[0].token, "tacuru");
    expect(second.body.result).toBe("ALREADY_COMPLETED");

    const team = await prisma.team.findFirstOrThrow({ where: { username: "v-dup" } });
    const valid = await prisma.stationVisit.findMany({
      where: { teamId: team.id, status: "VALID" },
    });
    expect(valid).toHaveLength(1);
  });

  it("acepta una posta de confirmación sin respuesta", async () => {
    await addTeam(fx.eventId, "v-conf", "Conf", [
      fx.stations[0].id,
      fx.stations[1].id,
      fx.stations[2].id,
    ]);
    const { agent, csrfToken } = await loginAs(app, "v-conf", "equipo-pass-123");

    await post(agent, csrfToken, fx.stations[0].token, "tacuru");
    await post(agent, csrfToken, fx.stations[1].token, "siete");
    const res = await post(agent, csrfToken, fx.stations[2].token, "");
    expect(res.body.result).toBe("VALID");
  });

  it("registra una sola visita válida ante solicitudes concurrentes", async () => {
    await addTeam(fx.eventId, "v-race", "Race", [fx.stations[0].id, fx.stations[1].id]);
    const { agent, csrfToken } = await loginAs(app, "v-race", "equipo-pass-123");

    const attempts = Array.from({ length: 8 }).map(() =>
      post(agent, csrfToken, fx.stations[0].token, "tacuru")
    );
    const results = await Promise.all(attempts);
    const valid = results.filter((r) => r.body.result === "VALID");
    const already = results.filter((r) => r.body.result === "ALREADY_COMPLETED");
    expect(valid).toHaveLength(1);
    expect(already.length).toBe(7);

    const team = await prisma.team.findFirstOrThrow({ where: { username: "v-race" } });
    const validRows = await prisma.stationVisit.count({
      where: { teamId: team.id, status: "VALID" },
    });
    expect(validRows).toBe(1);
  });
});