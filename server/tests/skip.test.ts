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

function skip(
  agent: ReturnType<typeof request.agent>,
  csrfToken: string,
  phrase: string,
  reason = ""
) {
  return agent
    .post("/api/v1/visits/skip")
    .set("x-csrf-token", csrfToken)
    .send({ phrase, reason });
}

describe("Salto de posta con frase de rescate", () => {
  it("rechaza una frase incorrecta sin registrar el salto", async () => {
    await addTeam(fx.eventId, "s-bad", "Bad", [fx.stations[0].id, fx.stations[1].id]);
    const { agent, csrfToken } = await loginAs(app, "s-bad", "equipo-pass-123");

    const res = await skip(agent, csrfToken, "frase-que-no-es");
    expect(res.status).toBe(200);
    expect(res.body.result).toBe("RESCUE_PHRASE_INVALID");

    const team = await prisma.team.findFirstOrThrow({ where: { username: "s-bad" } });
    expect(
      await prisma.stationVisit.count({ where: { teamId: team.id, status: "SKIPPED" } })
    ).toBe(0);

    const passport = await agent.get("/api/v1/passport");
    expect(passport.body.progress.completed).toBe(0);
  });

  it("salta la posta actual y avanza el recorrido (ignora mayúsculas y espacios)", async () => {
    await addTeam(fx.eventId, "s-ok", "OK", [
      fx.stations[0].id,
      fx.stations[1].id,
      fx.stations[2].id,
    ]);
    const { agent, csrfToken } = await loginAs(app, "s-ok", "equipo-pass-123");

    const res = await skip(agent, csrfToken, "  RESCATE-ALPHA ", "faltaba el cartel");
    expect(res.status).toBe(200);
    expect(res.body.result).toBe("SKIPPED");
    expect(res.body.skippedStation.id).toBe(fx.stations[0].id);
    expect(res.body.nextStation.id).toBe(fx.stations[1].id);
    expect(res.body.remaining).toBe(2);

    const passport = await agent.get("/api/v1/passport");
    expect(passport.body.progress.skipped).toBe(1);
    expect(passport.body.progress.completed).toBe(1);
    expect(passport.body.progress.valid).toBe(0);

    const stop0 = passport.body.stops.find(
      (s: { stationId: string }) => s.stationId === fx.stations[0].id
    );
    expect(stop0.skipped).toBe(true);
    expect(stop0.completed).toBe(false);

    // La posta siguiente (Beta) es ahora la actual y se puede registrar normal.
    const beta = await agent
      .post("/api/v1/visits")
      .set("x-csrf-token", csrfToken)
      .send({ publicToken: fx.stations[1].token, answer: "siete" });
    expect(beta.body.result).toBe("VALID");
  });

  it("deshabilita el salto si la posta no tiene frase de rescate", async () => {
    // Beta no tiene rescuePhrase y es la primera del recorrido.
    await addTeam(fx.eventId, "s-dis", "Dis", [fx.stations[1].id, fx.stations[2].id]);
    const { agent, csrfToken } = await loginAs(app, "s-dis", "equipo-pass-123");

    const res = await skip(agent, csrfToken, "lo-que-sea");
    expect(res.body.result).toBe("SKIP_DISABLED");
  });

  it("informa ALL_RESOLVED cuando no quedan postas pendientes", async () => {
    await addTeam(fx.eventId, "s-all", "All", [fx.stations[0].id]);
    const { agent, csrfToken } = await loginAs(app, "s-all", "equipo-pass-123");

    const first = await skip(agent, csrfToken, "rescate-alpha");
    expect(first.body.result).toBe("SKIPPED");

    const again = await skip(agent, csrfToken, "rescate-alpha");
    expect(again.body.result).toBe("ALL_RESOLVED");
  });

  it("acredita media puntuación por posta saltada en actividades STATIONS", async () => {
    const activity = await prisma.activity.create({
      data: {
        eventId: fx.eventId,
        name: "Recorrido de prueba",
        scoringMethod: "STATIONS",
        maxScore: 10,
        position: 99,
      },
    });

    await addTeam(fx.eventId, "s-score", "Score", [fx.stations[0].id, fx.stations[1].id]);
    const { agent, csrfToken } = await loginAs(app, "s-score", "equipo-pass-123");

    await skip(agent, csrfToken, "rescate-alpha");

    const team = await prisma.team.findFirstOrThrow({ where: { username: "s-score" } });
    const score = await prisma.teamActivityScore.findFirstOrThrow({
      where: { teamId: team.id, activityId: activity.id },
    });
    // 0 superadas + 0.5 * 1 saltada, sobre 10 puntos / 2 postas = 2.5.
    expect(score.score).toBe(2.5);
    expect(score.evaluated).toBe(true);
    expect(score.evaluatedBy).toBe("sistema");
  });
});
