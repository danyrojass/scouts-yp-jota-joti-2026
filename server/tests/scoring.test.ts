import { beforeAll, describe, expect, it } from "vitest";
import {
  createAdmin,
  createApp,
  loginAs,
  request,
  seedFixture,
  type Fixture,
  type SessionAgent,
} from "./helpers";
import { prisma } from "@/lib/prisma";

const app = createApp();
let fx: Fixture;
let admin: SessionAgent;

let walk: string;
let safari: string;
let secret: string;
let otherEventActivity: string;

async function createActivity(
  agent: SessionAgent,
  body: { eventId: string; name: string } & Record<string, unknown>
) {
  const res = await agent.agent
    .post("/api/v1/admin/scoring/activities")
    .set("x-csrf-token", agent.csrfToken)
    .send(body);
  return res;
}

async function upsertScore(
  agent: SessionAgent,
  body: Record<string, unknown>
) {
  return agent.agent
    .put("/api/v1/admin/scoring/scores")
    .set("x-csrf-token", agent.csrfToken)
    .send(body);
}

async function publishRanking(agent: SessionAgent, eventId: string, published: boolean) {
  return agent.agent
    .post("/api/v1/admin/scoring/ranking/publish")
    .set("x-csrf-token", agent.csrfToken)
    .send({ eventId, published });
}

beforeAll(async () => {
  await createAdmin("scoring-root", "s3cret-admin");
  admin = await loginAs(app, "scoring-root", "s3cret-admin");

  fx = await seedFixture([
    { name: "Safari Aguara", username: "scoring-aguara", order: [0, 1, 2, 3] },
    { name: "Safari Lobo", username: "scoring-lobo", order: [0, 1, 2, 3] },
  ]);

  const other = await seedFixture([
    { name: "Equipo Ajeno", username: "scoring-ajeno", order: [0, 1, 2, 3] },
  ]);
  const otherActivity = await createActivity(admin, {
    eventId: other.eventId,
    name: "Posta de otro evento",
    maxScore: 5,
  });
  otherEventActivity = otherActivity.body.activity.id;

  const walkRes = await createActivity(admin, {
    eventId: fx.eventId,
    name: "Caminata",
    description: "Exploración urbana",
    maxScore: 10,
    scoringMethod: "MANUAL",
    published: true,
  });
  walk = walkRes.body.activity.id;

  const safariRes = await createActivity(admin, {
    eventId: fx.eventId,
    name: "Safari",
    maxScore: null,
    scoringMethod: "CHECKLIST",
    published: true,
  });
  safari = safariRes.body.activity.id;

  const secretRes = await createActivity(admin, {
    eventId: fx.eventId,
    name: "Misión secreta",
    maxScore: 5,
    scoringMethod: "MANUAL",
    published: false,
  });
  secret = secretRes.body.activity.id;
});

describe("Seguridad del módulo de puntajes", () => {
  it("bloquea el acceso de un equipo a las rutas admin", async () => {
    const { agent } = await loginAs(app, "scoring-aguara", "equipo-pass-123");
    const res = await agent.get(`/api/v1/admin/scoring/activities?eventId=${fx.eventId}`);
    expect(res.status).toBe(403);
  });

  it("el ranking público se puede consultar sin sesión", async () => {
    const res = await request.agent(app).get(`/api/v1/ranking/${fx.eventId}`);
    expect(res.status).toBe(200);
  });
});

describe("CRUD de actividades", () => {
  it("lista las actividades creadas en orden de posición", async () => {
    const res = await admin.agent.get(
      `/api/v1/admin/scoring/activities?eventId=${fx.eventId}`
    );
    expect(res.status).toBe(200);
    const names = res.body.activities.map((a: { name: string }) => a.name);
    expect(names).toEqual(["Caminata", "Safari", "Misión secreta"]);
  });

  it("rechaza nombres duplicados dentro del mismo evento", async () => {
    const res = await createActivity(admin, { eventId: fx.eventId, name: "Caminata" });
    expect(res.status).toBe(409);
  });

  it("permite mismo nombre en eventos distintos", async () => {
    const other = await seedFixture([
      { name: "Equipo Duplicado", username: "scoring-duplicado", order: [0, 1, 2, 3] },
    ]);
    const res = await createActivity(admin, { eventId: other.eventId, name: "Caminata" });
    expect(res.status).toBe(201);
  });

  it("actualiza una actividad (estado, publicación y máximo)", async () => {
    const res = await admin.agent
      .patch(`/api/v1/admin/scoring/activities/${safari}`)
      .set("x-csrf-token", admin.csrfToken)
      .send({ status: "IN_EVALUATION", published: true, allowMaxScoreExceeded: true });
    expect(res.status).toBe(200);
    expect(res.body.activity).toMatchObject({
      status: "IN_EVALUATION",
      allowMaxScoreExceeded: true,
    });

    await admin.agent
      .patch(`/api/v1/admin/scoring/activities/${safari}`)
      .set("x-csrf-token", admin.csrfToken)
      .send({ status: "PENDING", allowMaxScoreExceeded: false });
  });

  it("reordena las actividades", async () => {
    const reversed = [secret, safari, walk];
    const res = await admin.agent
      .patch("/api/v1/admin/scoring/activities/reorder")
      .set("x-csrf-token", admin.csrfToken)
      .send({ eventId: fx.eventId, activityIds: reversed });
    expect(res.status).toBe(200);
    expect(res.body.activities.map((a: { id: string }) => a.id)).toEqual(reversed);

    const restore = await admin.agent
      .patch("/api/v1/admin/scoring/activities/reorder")
      .set("x-csrf-token", admin.csrfToken)
      .send({ eventId: fx.eventId, activityIds: [walk, safari, secret] });
    expect(restore.status).toBe(200);
  });

  it("rechaza una lista de reordenamiento incompleta", async () => {
    const res = await admin.agent
      .patch("/api/v1/admin/scoring/activities/reorder")
      .set("x-csrf-token", admin.csrfToken)
      .send({ eventId: fx.eventId, activityIds: [walk, safari] });
    expect(res.status).toBe(400);
  });

  it("elimina una actividad y sus puntajes asociados", async () => {
    const created = await createActivity(admin, { eventId: fx.eventId, name: "Efímera" });
    const id = created.body.activity.id;
    const team = fx.teams[0];

    await upsertScore(admin, {
      eventId: fx.eventId,
      teamId: team.id,
      activityId: id,
      evaluated: true,
      score: 3,
    });

    const del = await admin.agent
      .delete(`/api/v1/admin/scoring/activities/${id}`)
      .set("x-csrf-token", admin.csrfToken);
    expect(del.status).toBe(204);

    const gone = await prisma.activity.findUnique({ where: { id } });
    expect(gone).toBeNull();
    const orphan = await prisma.teamActivityScore.findFirst({
      where: { activityId: id },
    });
    expect(orphan).toBeNull();
  });
});

describe("Carga de puntajes", () => {
  const teamA = () => fx.teams[0].id;
  const teamB = () => fx.teams[1].id;

  it("registra un puntaje evaluado con auditoría", async () => {
    const res = await upsertScore(admin, {
      eventId: fx.eventId,
      teamId: teamA(),
      activityId: walk,
      evaluated: true,
      score: 8,
      observations: "Muy buen trabajo",
    });
    expect(res.status).toBe(200);
    expect(res.body.created).toBe(true);
    expect(res.body.score).toMatchObject({ evaluated: true, score: 8 });

    const log = await prisma.auditLog.findFirst({
      where: { action: "CREATE", entity: "TeamActivityScore" },
      orderBy: { createdAt: "desc" },
    });
    expect(log).not.toBeNull();
  });

  it("actualiza el mismo resultado en lugar de duplicarlo", async () => {
    const first = await upsertScore(admin, {
      eventId: fx.eventId,
      teamId: teamA(),
      activityId: walk,
      evaluated: true,
      score: 8,
    });
    const second = await upsertScore(admin, {
      eventId: fx.eventId,
      teamId: teamA(),
      activityId: walk,
      evaluated: true,
      score: 9,
    });
    expect(second.body.created).toBe(false);
    expect(second.body.score.id).toBe(first.body.score.id);
    expect(second.body.score.score).toBe(9);
  });

  it("rechaza puntajes negativos", async () => {
    const res = await upsertScore(admin, {
      eventId: fx.eventId,
      teamId: teamA(),
      activityId: walk,
      evaluated: true,
      score: -3,
    });
    expect(res.status).toBe(400);
  });

  it("rechaza superar el máximo de la actividad", async () => {
    const res = await upsertScore(admin, {
      eventId: fx.eventId,
      teamId: teamA(),
      activityId: walk,
      evaluated: true,
      score: 11,
    });
    expect(res.status).toBe(400);
  });

  it("permite superar el máximo si la actividad lo habilita", async () => {
    await admin.agent
      .patch(`/api/v1/admin/scoring/activities/${safari}`)
      .set("x-csrf-token", admin.csrfToken)
      .send({ maxScore: 5, allowMaxScoreExceeded: true });
    const res = await upsertScore(admin, {
      eventId: fx.eventId,
      teamId: teamA(),
      activityId: safari,
      evaluated: true,
      score: 7,
    });
    expect(res.status).toBe(200);
  });

  it("una actividad sin evaluar no cuenta como cero", async () => {
    const res = await upsertScore(admin, {
      eventId: fx.eventId,
      teamId: teamB(),
      activityId: walk,
      evaluated: false,
    });
    expect(res.status).toBe(200);
    expect(res.body.score).toMatchObject({ evaluated: false, score: null });
  });

  it("requiere puntaje para marcar como evaluado", async () => {
    const res = await upsertScore(admin, {
      eventId: fx.eventId,
      teamId: teamB(),
      activityId: walk,
      evaluated: true,
    });
    expect(res.status).toBe(400);
  });

  it("no permite puntuar a un equipo con actividad de otro evento", async () => {
    const res = await upsertScore(admin, {
      eventId: fx.eventId,
      teamId: teamA(),
      activityId: otherEventActivity,
      evaluated: true,
      score: 5,
    });
    expect(res.status).toBe(400);
  });

  it("elimina el resultado de un equipo", async () => {
    const created = await upsertScore(admin, {
      eventId: fx.eventId,
      teamId: teamB(),
      activityId: safari,
      evaluated: true,
      score: 4,
    });
    const del = await admin.agent
      .delete(`/api/v1/admin/scoring/scores/${created.body.score.id}`)
      .set("x-csrf-token", admin.csrfToken);
    expect(del.status).toBe(204);
    const gone = await prisma.teamActivityScore.findUnique({
      where: { id: created.body.score.id },
    });
    expect(gone).toBeNull();
  });
});

describe("Ranking general (admin)", () => {
  it("calcula el total solo con actividades evaluadas", async () => {
    // Aguara: caminata 9 (ya puntuado), safari evaluado → total sumado.
    await upsertScore(admin, {
      eventId: fx.eventId,
      teamId: fx.teams[0].id,
      activityId: walk,
      evaluated: true,
      score: 9,
    });
    await upsertScore(admin, {
      eventId: fx.eventId,
      teamId: fx.teams[0].id,
      activityId: safari,
      evaluated: true,
      score: 7,
    });
    // Lobo: caminata puntuado, safari pendiente → solo cuenta la caminata.
    await upsertScore(admin, {
      eventId: fx.eventId,
      teamId: fx.teams[1].id,
      activityId: walk,
      evaluated: true,
      score: 5,
    });

    const res = await admin.agent.get(
      `/api/v1/admin/scoring/ranking?eventId=${fx.eventId}`
    );
    expect(res.status).toBe(200);
    const rows = res.body.teams as Record<string, unknown>[];
    const aguara = rows.find((r) => r.team === "Safari Aguara");
    const lobo = rows.find((r) => r.team === "Safari Lobo");

    expect(aguara).toMatchObject({
      total: 16,
      evaluatedCount: 2,
      pendingCount: 1,
      activitiesCount: 3,
      position: 1,
      status: "EN_EVALUACION",
    });
    expect(lobo).toMatchObject({
      total: 5,
      evaluatedCount: 1,
      position: 2,
    });
    expect(res.body.allComplete).toBe(false);
  });

  it("resuelve los empates con ranking 1224", async () => {
    const tie = await seedFixture([
      { name: "Equipo Uno", username: "ties-uno", order: [0, 1, 2, 3] },
      { name: "Equipo Dos", username: "ties-dos", order: [0, 1, 2, 3] },
      { name: "Equipo Tres", username: "ties-tres", order: [0, 1, 2, 3] },
    ]);
    const { agent, csrfToken } = admin;
    const created = await createActivity(admin, {
      eventId: tie.eventId,
      name: "Posta única",
      maxScore: 10,
    });
    const activityId = created.body.activity.id;

    for (const [name, score] of [
      ["Equipo Uno", 10],
      ["Equipo Dos", 10],
      ["Equipo Tres", 3],
    ] as const) {
      const team = tie.teams.find((t) => t.name === name)!;
      await agent
        .put("/api/v1/admin/scoring/scores")
        .set("x-csrf-token", csrfToken)
        .send({
          eventId: tie.eventId,
          teamId: team.id,
          activityId,
          evaluated: true,
          score,
        });
    }

    const res = await agent.get(`/api/v1/admin/scoring/ranking?eventId=${tie.eventId}`);
    const rows = res.body.teams as Record<string, unknown>[];
    const uno = rows.find((r) => r.team === "Equipo Uno");
    const dos = rows.find((r) => r.team === "Equipo Dos");
    const tres = rows.find((r) => r.team === "Equipo Tres");
    expect(uno?.position).toBe(1);
    expect(dos?.position).toBe(1);
    expect(tres?.position).toBe(3);
  });

  it("marca a los equipos inactivos sin afectar su posición", async () => {
    await prisma.team.update({
      where: { id: fx.teams[1].id },
      data: { active: false },
    });
    const res = await admin.agent.get(
      `/api/v1/admin/scoring/ranking?eventId=${fx.eventId}`
    );
    const lobo = res.body.teams.find(
      (r: { team: string }) => r.team === "Safari Lobo"
    );
    expect(lobo.status).toBe("INACTIVO");
    await prisma.team.update({
      where: { id: fx.teams[1].id },
      data: { active: true },
    });
  });

  it("aísla el ranking por evento", async () => {
    const other = await seedFixture([
      { name: "Equipo Solo", username: "scoring-solo", order: [0, 1, 2, 3] },
    ]);
    const res = await admin.agent.get(
      `/api/v1/admin/scoring/ranking?eventId=${other.eventId}`
    );
    expect(res.status).toBe(200);
    expect(res.body.teams).toHaveLength(1);
    expect(res.body.teams[0].team).toBe("Equipo Solo");
    expect(res.body.teams[0].total).toBe(0);
  });
});

describe("Publicación y vista pública", () => {
  it("no publica el ranking hasta autorizarlo", async () => {
    const res = await admin.agent.get(`/api/v1/ranking/${fx.eventId}`);
    expect(res.status).toBe(200);
    expect(res.body.published).toBe(false);
    expect(res.body.teams).toEqual([]);
  });

  it("publica y expone la vista (sin observaciones)", async () => {
    const pub = await publishRanking(admin, fx.eventId, true);
    expect(pub.status).toBe(200);
    expect(pub.body.event.rankingPublished).toBe(true);

    const res = await admin.agent.get(`/api/v1/ranking/${fx.eventId}`);
    expect(res.status).toBe(200);
    expect(res.body.published).toBe(true);
    expect(res.body.teams.length).toBeGreaterThan(0);
    const aguara = res.body.teams.find((t: { team: string }) => t.team === "Safari Aguara");
    expect(aguara.total).toBe(16);

    const detail = await admin.agent.get(
      `/api/v1/ranking/${fx.eventId}/teams/${fx.teams[0].id}`
    );
    expect(detail.status).toBe(200);
    expect(detail.body).not.toHaveProperty("observations");
    const first = detail.body.activities.find(
      (a: { name: string }) => a.name === "Caminata"
    );
    expect(first.scored).toBe(true);
    expect(first.score).toBe(9);
  });

  it("excluye actividades no publicadas de la vista pública", async () => {
    await upsertScore(admin, {
      eventId: fx.eventId,
      teamId: fx.teams[0].id,
      activityId: secret,
      evaluated: true,
      score: 5,
    });
    const res = await admin.agent.get(`/api/v1/ranking/${fx.eventId}`);
    const names = res.body.activities.map((a: { name: string }) => a.name);
    expect(names).not.toContain("Misión secreta");
    // El total público no incluye la actividad oculta.
    const aguara = res.body.teams.find((t: { team: string }) => t.team === "Safari Aguara");
    expect(aguara.total).toBe(16);
    // El ranking admin sí la considera.
    const adminRanking = await admin.agent.get(
      `/api/v1/admin/scoring/ranking?eventId=${fx.eventId}`
    );
    const aguaraAdmin = adminRanking.body.teams.find(
      (t: { team: string }) => t.team === "Safari Aguara"
    );
    expect(aguaraAdmin.total).toBe(21);
  });

  it("oculta el ranking de nuevo al despublicar", async () => {
    const hide = await publishRanking(admin, fx.eventId, false);
    expect(hide.status).toBe(200);
    expect(hide.body.event.rankingPublished).toBe(false);
    const res = await admin.agent.get(`/api/v1/ranking/${fx.eventId}`);
    expect(res.body.published).toBe(false);
    expect(res.body.teams).toEqual([]);
  });

  it("permite publicar dejando un ranking conservado", async () => {
    await publishRanking(admin, fx.eventId, true);
    const res = await admin.agent.get(`/api/v1/ranking/${fx.eventId}`);
    expect(res.body.published).toBe(true);
    await publishRanking(admin, fx.eventId, false);
  });
});

describe("Exportación CSV", () => {
  it("genera el archivo con encabezados y datos", async () => {
    const res = await admin.agent.get(
      `/api/v1/admin/scoring/export?eventId=${fx.eventId}`
    );
    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toMatch(/text\/csv/);
    const text = String(res.text);
    expect(text).toContain("Posicion");
    expect(text).toContain("Caminata");
    expect(text).toContain("Safari Aguara");
    expect(text).toContain("Evaluado");
  });
});

describe("Auditoría", () => {
  it("registra la creación de actividades", async () => {
    const log = await prisma.auditLog.findFirst({
      where: { action: "CREATE", entity: "Activity", details: { contains: "Caminata" } },
      orderBy: { createdAt: "desc" },
    });
    expect(log).not.toBeNull();
    expect(log!.details).toContain("Caminata");
  });

  it("registra la publicación y despublicación del ranking", async () => {
    await publishRanking(admin, fx.eventId, true);
    const pub = await prisma.auditLog.findFirst({
      where: { action: "RANKING_PUBLISHED", entity: "Event" },
      orderBy: { createdAt: "desc" },
    });
    expect(pub).not.toBeNull();
    await publishRanking(admin, fx.eventId, false);
    const hide = await prisma.auditLog.findFirst({
      where: { action: "RANKING_UNPUBLISHED", entity: "Event" },
      orderBy: { createdAt: "desc" },
    });
    expect(hide).not.toBeNull();
  });
});