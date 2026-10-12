import { beforeAll, describe, expect, it } from "vitest";
import {
  createAdmin,
  createApp,
  loginAs,
  seedFixture,
  setEventStatus,
  type Fixture,
  type SessionAgent,
} from "./helpers";
import { prisma } from "@/lib/prisma";

const app = createApp();
let fx: Fixture;
let admin: SessionAgent;
let safariId: string;
let itemIds: string[];

const ITEMS = ["Hoja de ceibo", "Pluma de ave", "Huella en el barro"];

beforeAll(async () => {
  fx = await seedFixture([
    { name: "Safari Aguara", username: "safari-aguara", order: [0, 1, 2, 3] },
    { name: "Safari Lobo", username: "safari-lobo", order: [0, 1, 2, 3] },
  ]);

  await createAdmin("safari-root", "s3cret-admin");
  admin = await loginAs(app, "safari-root", "s3cret-admin");

  const created = await admin.agent
    .post("/api/v1/admin/safari")
    .set("x-csrf-token", admin.csrfToken)
    .send({ eventId: fx.eventId, title: "Safari de prueba" });
  expect(created.status).toBe(201);
  safariId = created.body.safari.id;

  itemIds = [];
  for (const name of ITEMS) {
    const res = await admin.agent
      .post(`/api/v1/admin/safari/${safariId}/items`)
      .set("x-csrf-token", admin.csrfToken)
      .send({ name });
    expect(res.status).toBe(201);
    itemIds.push(res.body.item.id);
  }
});

async function teamAgent(username: string) {
  return loginAs(app, username, "equipo-pass-123");
}

describe("Safari de Exploración", () => {
  it("rechaza un segundo safari para el mismo evento", async () => {
    const res = await admin.agent
      .post("/api/v1/admin/safari")
      .set("x-csrf-token", admin.csrfToken)
      .send({ eventId: fx.eventId });
    expect(res.status).toBe(409);
  });

  it("el equipo ve el checklist vacío al inicio", async () => {
    const { agent } = await teamAgent("safari-aguara");
    const res = await agent.get("/api/v1/safari");
    expect(res.status).toBe(200);
    expect(res.body.safari.title).toBe("Safari de prueba");
    expect(res.body.items).toHaveLength(3);
    expect(res.body.items.every((i: { found: boolean }) => !i.found)).toBe(true);
    expect(res.body.progress).toMatchObject({ total: 3, found: 0, done: false, percent: 0 });
  });

  it("no permite marcar antes de que el evento esté en curso", async () => {
    await setEventStatus(fx.eventId, "PREPARED");
    const { agent, csrfToken } = await teamAgent("safari-aguara");
    const res = await agent
      .post(`/api/v1/safari/items/${itemIds[0]}/find`)
      .set("x-csrf-token", csrfToken);
    void admin;
    expect(res.status).toBe(409);
  });

  it("marca un elemento como encontrado (idempotente) y actualiza el progreso", async () => {
    await setEventStatus(fx.eventId, "IN_PROGRESS");
    const { agent, csrfToken } = await teamAgent("safari-aguara");

    const first = await agent
      .post(`/api/v1/safari/items/${itemIds[0]}/find`)
      .set("x-csrf-token", csrfToken);
    expect(first.status).toBe(200);
    expect(first.body.progress.found).toBe(1);
    expect(first.body.items.find((i: { id: string }) => i.id === itemIds[0]).found).toBe(true);

    const again = await agent
      .post(`/api/v1/safari/items/${itemIds[0]}/find`)
      .set("x-csrf-token", csrfToken);
    expect(again.body.progress.found).toBe(1);

    const count = await prisma.safariFind.count({ where: { itemId: itemIds[0] } });
    expect(count).toBe(1);
  });

  it("permite desmarcar un elemento", async () => {
    const { agent, csrfToken } = await teamAgent("safari-aguara");
    const res = await agent
      .delete(`/api/v1/safari/items/${itemIds[0]}/find`)
      .set("x-csrf-token", csrfToken);
    expect(res.status).toBe(200);
    expect(res.body.progress.found).toBe(0);
  });

  it("oculta los elementos inactivos y no los cuenta", async () => {
    await admin.agent
      .patch(`/api/v1/admin/safari/items/${itemIds[2]}`)
      .set("x-csrf-token", admin.csrfToken)
      .send({ active: false });

    const { agent } = await teamAgent("safari-aguara");
    const res = await agent.get("/api/v1/safari");
    expect(res.body.items.map((i: { id: string }) => i.id)).not.toContain(itemIds[2]);
    expect(res.body.progress.total).toBe(2);

    await admin.agent
      .patch(`/api/v1/admin/safari/items/${itemIds[2]}`)
      .set("x-csrf-token", admin.csrfToken)
      .send({ active: true });
  });

  it("aísla el safari entre eventos", async () => {
    const other = await seedFixture([
      { name: "Equipo Ajeno", username: "safari-ajeno", order: [0, 1, 2, 3] },
    ]);
    await setEventStatus(other.eventId, "IN_PROGRESS");
    const { agent, csrfToken } = await teamAgent("safari-ajeno");
    const res = await agent
      .post(`/api/v1/safari/items/${itemIds[0]}/find`)
      .set("x-csrf-token", csrfToken);
    expect(res.status).toBe(403);
  });

  it("reporta el progreso por equipo al administrador", async () => {
    const { agent, csrfToken } = await teamAgent("safari-lobo");
    await agent.post(`/api/v1/safari/items/${itemIds[0]}/find`).set("x-csrf-token", csrfToken);
    await agent.post(`/api/v1/safari/items/${itemIds[1]}/find`).set("x-csrf-token", csrfToken);

    const res = await admin.agent.get(`/api/v1/admin/safari/${safariId}/progress`);
    expect(res.status).toBe(200);
    expect(res.body.counts.activeItems).toBe(3);

    const lobo = res.body.teams.find((t: { team: string }) => t.team === "Safari Lobo");
    expect(lobo.found).toBe(2);
    expect(lobo.percent).toBe(67);

    const top = res.body.items[0];
    expect(top.teams).toBeGreaterThanOrEqual(1);
  });

  it("reordena los elementos", async () => {
    const reversed = [...itemIds].reverse();
    const res = await admin.agent
      .post(`/api/v1/admin/safari/${safariId}/reorder`)
      .set("x-csrf-token", admin.csrfToken)
      .send({ itemIds: reversed });
    expect(res.status).toBe(200);

    const ordered = [...res.body.safari.items].sort(
      (a: { position: number }, b: { position: number }) => a.position - b.position
    );
    expect(ordered.map((i: { id: string }) => i.id)).toEqual(reversed);

    await admin.agent
      .post(`/api/v1/admin/safari/${safariId}/reorder`)
      .set("x-csrf-token", admin.csrfToken)
      .send({ itemIds });
  });

  it("reinicia el progreso y lo registra en auditoría", async () => {
    const before = await prisma.safariFind.count({ where: { safariId } });
    expect(before).toBeGreaterThan(0);

    const res = await admin.agent
      .post("/api/v1/admin/safari/reset")
      .set("x-csrf-token", admin.csrfToken)
      .send({ eventId: fx.eventId });
    expect(res.status).toBe(200);
    expect(res.body.deleted).toBe(before);

    const after = await prisma.safariFind.count({ where: { safariId } });
    expect(after).toBe(0);

    const log = await prisma.auditLog.findFirst({
      where: { action: "SAFARI_PROGRESS_RESET", entityId: safariId },
    });
    expect(log).not.toBeNull();
  });
});
