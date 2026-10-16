import type { Response } from "superagent";
import { beforeAll, describe, expect, it } from "vitest";
import QRCode from "qrcode";
import { PNG } from "pngjs";
import {
  createAdmin,
  createApp,
  loginAs,
  request,
  seedFixture,
  setEventStatus,
  type Fixture,
  type SessionAgent,
} from "./helpers";

const app = createApp();
let fx: Fixture;
let admin: SessionAgent;

beforeAll(async () => {
  fx = await seedFixture([
    { name: "QR Team", username: "qr-team", order: [0, 1, 2, 3] },
  ]);
  await createAdmin("qr-root", "s3cret-admin");
  admin = await loginAs(app, "qr-root", "s3cret-admin");
});

function binaryParser(res: Response, cb: (err: Error | null, body: Buffer) => void) {
  const chunks: Buffer[] = [];
  res.on("data", (chunk: Buffer) => chunks.push(chunk));
  res.on("end", () => cb(null, Buffer.concat(chunks)));
}

describe("QR de postas", () => {
  it("devuelve un PNG cuadrado con el logo del grupo en el centro", async () => {
    const res = await admin.agent
      .get(`/api/v1/stations/${fx.stations[0].id}/qr`)
      .buffer(true)
      .parse(binaryParser);

    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toContain("image/png");

    const branded = PNG.sync.read(res.body as Buffer);
    expect(branded.width).toBe(branded.height);

    const url = `https://evento.test/posta/${fx.stations[0].token}`;
    const plain = PNG.sync.read(
      await QRCode.toBuffer(url, {
        type: "png",
        width: branded.width,
        margin: 2,
        errorCorrectionLevel: "H",
      })
    );

    // El logo tapa el centro: ese pixel ya no coincide con el QR sin marca.
    const center = ((branded.height / 2) * branded.width + branded.width / 2) * 4;
    const plainCenter = ((plain.height / 2) * plain.width + plain.width / 2) * 4;
    const brandedPixel = branded.data.slice(center, center + 3).join(",");
    const plainPixel = plain.data.slice(plainCenter, plainCenter + 3).join(",");
    expect(brandedPixel).not.toBe(plainPixel);
  });

  it("requiere sesión de administrador", async () => {
    const res = await request(app).get(`/api/v1/stations/${fx.stations[0].id}/qr`);
    expect(res.status).toBe(401);
  });
});

describe("Estado público del token (sin sesión)", () => {
  it("responde OPEN mientras el evento no terminó", async () => {
    await setEventStatus(fx.eventId, "IN_PROGRESS");
    const res = await request(app).get(
      `/api/v1/stations/public/${fx.stations[1].token}`
    );
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: "OPEN" });
  });

  it("responde CLOSED cuando el evento finalizó o se canceló", async () => {
    await setEventStatus(fx.eventId, "FINISHED");
    const finished = await request(app).get(
      `/api/v1/stations/public/${fx.stations[1].token}`
    );
    expect(finished.body).toEqual({ status: "CLOSED" });

    await setEventStatus(fx.eventId, "CANCELLED");
    const cancelled = await request(app).get(
      `/api/v1/stations/public/${fx.stations[1].token}`
    );
    expect(cancelled.body).toEqual({ status: "CLOSED" });
  });

  it("responde NOT_FOUND para un token desconocido", async () => {
    const res = await request(app).get(
      "/api/v1/stations/public/token-que-no-existe"
    );
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: "NOT_FOUND" });
  });
});
