import { beforeAll, describe, expect, it } from "vitest";
import { createApp, loginAs, request, seedFixture, setEventStatus, type Fixture } from "./helpers";

const app = createApp();
let fx: Fixture;

beforeAll(async () => {
  fx = await seedFixture([
    { name: "Aguara", username: "aguara", order: [0, 1, 2, 3] },
  ]);
});

describe("Itinerario propio", () => {
  it("devuelve las postas del equipo en el orden configurado", async () => {
    const { agent } = await loginAs(app, "aguara", "equipo-pass-123");
    const res = await agent.get("/api/v1/passport");
    expect(res.status).toBe(200);
    expect(res.body.progress.total).toBe(4);
    expect(res.body.progress.completed).toBe(0);
    expect(res.body.progress.nextStationId).toBe(fx.stations[0].id);

    const positions = res.body.stops.map((s: { position: number }) => s.position);
    expect(positions).toEqual([1, 2, 3, 4]);
    expect(res.body.stops[0].stationId).toBe(fx.stations[0].id);
    expect(res.body.stops[0].name).toBe(fx.stations[0].name);
  });

  it("expone la próxima posta", async () => {
    const { agent } = await loginAs(app, "aguara", "equipo-pass-123");
    const res = await agent.get("/api/v1/passport/next-station");
    expect(res.body.nextStation).toBe(fx.stations[0].id);
  });

  it("no entrega la respuesta esperada al cliente", async () => {
    await setEventStatus(fx.eventId, "IN_PROGRESS");
    const { agent } = await loginAs(app, "aguara", "equipo-pass-123");
    const res = await agent.get(`/api/v1/visits/posta/${fx.stations[0].token}`);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("NEXT");
    expect(res.body.station).toBeDefined();
    const serialized = JSON.stringify(res.body);
    expect(serialized).not.toContain("tacuru");
    expect(res.body.station.expectedAnswer).toBeUndefined();
  });

  it("resuelve el estado NEXT/COMPLETED según avance", async () => {
    await setEventStatus(fx.eventId, "IN_PROGRESS");
    const { agent, csrfToken } = await loginAs(app, "aguara", "equipo-pass-123");
    await agent
      .post("/api/v1/visits")
      .set("x-csrf-token", csrfToken)
      .send({ publicToken: fx.stations[0].token, answer: "tacuru" });

    const done = await agent.get(`/api/v1/visits/posta/${fx.stations[0].token}`);
    expect(done.body.status).toBe("COMPLETED");
  });
});