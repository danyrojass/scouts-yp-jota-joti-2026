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

describe("Aislamiento entre equipos e itinerarios que comparten QR", () => {
  it("cada equipo solo valida las postas de su propio itinerario", async () => {
    // Aguara: Alpha(CODE) -> Beta(QUESTION) -> ...
    await addTeam(fx.eventId, "iso-a", "Aislamiento A", [
      fx.stations[0].id,
      fx.stations[1].id,
    ]);
    // Zorro: Beta(QUESTION) -> Alpha(CODE) -> ...  (mismos QR, otro orden)
    await addTeam(fx.eventId, "iso-b", "Aislamiento B", [
      fx.stations[1].id,
      fx.stations[0].id,
    ]);

    const a = await loginAs(app, "iso-a", "equipo-pass-123");
    const b = await loginAs(app, "iso-b", "equipo-pass-123");

    // El QR de Beta no es la próxima posta de A.
    const aPeek = await a.agent.get(`/api/v1/visits/posta/${fx.stations[1].token}`);
    expect(aPeek.body.status).toBe("NOT_YOUR_NEXT");
    const aTry = await post(a.agent, a.csrfToken, fx.stations[1].token, "siete");
    expect(aTry.body.result).toBe("NOT_YOUR_NEXT");

    // El mismo QR sí es la primera posta de B.
    const bPeek = await b.agent.get(`/api/v1/visits/posta/${fx.stations[1].token}`);
    expect(bPeek.body.status).toBe("NEXT");
    const bOk = await post(b.agent, b.csrfToken, fx.stations[1].token, "siete");
    expect(bOk.body.result).toBe("VALID");

    // El avance de B no altera el de A.
    const aPassport = await a.agent.get("/api/v1/passport");
    expect(aPassport.body.progress.completed).toBe(0);
    const aTryAgain = await post(a.agent, a.csrfToken, fx.stations[1].token, "siete");
    expect(aTryAgain.body.result).toBe("NOT_YOUR_NEXT");

    // A puede seguir su propio camino.
    const aOk = await post(a.agent, a.csrfToken, fx.stations[0].token, "tacuru");
    expect(aOk.body.result).toBe("VALID");
    expect(aOk.body.nextStation.id).toBe(fx.stations[1].id);
  });

  it("un equipo no puede leer el pasaporte de otro", async () => {
    await addTeam(fx.eventId, "iso-c", "Aislamiento C", [fx.stations[0].id, fx.stations[1].id]);
    const c = await loginAs(app, "iso-c", "equipo-pass-123");
    const passport = await c.agent.get("/api/v1/passport");
    expect(passport.body.team.username).toBe("iso-c");
  });
});