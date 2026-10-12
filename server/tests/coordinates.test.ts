import { beforeAll, describe, expect, it } from "vitest";
import {
  createAdmin,
  createApp,
  loginAs,
  seedFixture,
  type Fixture,
  type SessionAgent,
} from "./helpers";
import { prisma } from "@/lib/prisma";

const app = createApp();
let fx: Fixture;
let admin: SessionAgent;

beforeAll(async () => {
  fx = await seedFixture([
    { name: "Coordenadas", username: "coord-team", order: [0, 1, 2, 3] },
  ]);
  await createAdmin("coord-root", "s3cret-admin");
  admin = await loginAs(app, "coord-root", "s3cret-admin");
});

const patchStation = (id: string, body: Record<string, unknown>) =>
  admin.agent
    .patch(`/api/v1/stations/${id}`)
    .set("x-csrf-token", admin.csrfToken)
    .send(body);

describe("Coordenadas de postas", () => {
  it("guarda coordenadas válidas", async () => {
    const res = await patchStation(fx.stations[0].id, {
      latitude: -25.3903,
      longitude: -57.2859,
    });
    expect(res.status).toBe(200);
    expect(res.body.station.latitude).toBeCloseTo(-25.3903);
    expect(res.body.station.longitude).toBeCloseTo(-57.2859);
  });

  it("rechaza coordenadas fuera de rango", async () => {
    const res = await patchStation(fx.stations[0].id, { latitude: 120 });
    expect(res.status).toBe(400);
    const res2 = await patchStation(fx.stations[0].id, { longitude: -200 });
    expect(res2.status).toBe(400);
  });

  it("importa coordenadas por nombre y reporta filas inválidas", async () => {
    const csv = [
      "nombre,qr_id,latitud,longitud,descripcion",
      "Posta Alpha,,-25.4000,-57.3000,Descripcion importada",
      "Posta Fantasma,,-25.5000,-57.2000,",
      "Posta Beta,,-999,-57.2000,",
    ].join("\n");

    const res = await admin.agent
      .post("/api/v1/stations/import")
      .set("x-csrf-token", admin.csrfToken)
      .send({ eventId: fx.eventId, csv });

    expect(res.status).toBe(200);
    expect(res.body.updated).toBe(1);
    expect(res.body.errors).toHaveLength(2);

    const alpha = await prisma.station.findFirstOrThrow({
      where: { eventId: fx.eventId, name: "Posta Alpha" },
    });
    expect(alpha.latitude).toBeCloseTo(-25.4);
    expect(alpha.description).toBe("Descripcion importada");

    const log = await prisma.auditLog.findFirst({
      where: { action: "IMPORT", eventId: fx.eventId },
    });
    expect(log).not.toBeNull();
  });

  it("expone coordenadas y enlace de Google Maps en el pasaporte del equipo", async () => {
    const { agent } = await loginAs(app, "coord-team", "equipo-pass-123");
    const res = await agent.get("/api/v1/passport");
    expect(res.status).toBe(200);

    const first = res.body.stops.find(
      (s: { stationId: string }) => s.stationId === fx.stations[0].id
    );
    expect(first.latitude).toBeCloseTo(-25.4000);
    expect(first.longitude).toBeCloseTo(-57.3000);
    expect(first.mapsUrl).toContain("https://www.google.com/maps/dir/?api=1");
    expect(first.mapsUrl).toContain("-25.4,-57.3");

    const withoutCoords = res.body.stops.find(
      (s: { stationId: string }) => s.stationId === fx.stations[3].id
    );
    expect(withoutCoords.latitude).toBeNull();
    expect(withoutCoords.mapsUrl).toBeNull();
  });
});
