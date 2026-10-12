import { beforeAll, describe, expect, it } from "vitest";
import { createApp, loginAs, request, seedFixture, createAdmin } from "./helpers";
import { prisma } from "@/lib/prisma";

const app = createApp();

beforeAll(async () => {
  await createAdmin("root", "s3cret-admin");
  await seedFixture([
    { name: "Aguara", username: "aguara", order: [0, 1, 2, 3] },
  ]);
});

describe("Autenticacion", () => {
  it("rechaza credenciales incorrectas de un administrador", async () => {
    const res = await request(app)
      .post("/api/v1/auth/login")
      .send({ username: "root", password: "incorrecta" });
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("UNAUTHORIZED");
  });

  it("rechaza un usuario inexistente", async () => {
    const res = await request(app)
      .post("/api/v1/auth/login")
      .send({ username: "nadie", password: "cualquier" });
    expect(res.status).toBe(401);
  });

  it("permite el login correcto de un administrador", async () => {
    const res = await request(app)
      .post("/api/v1/auth/login")
      .send({ username: "root", password: "s3cret-admin" });
    expect(res.status).toBe(200);
    expect(res.body.principal.type).toBe("admin");
  });

  it("permite el login correcto de un equipo", async () => {
    const res = await request(app)
      .post("/api/v1/auth/login")
      .send({ username: "aguara", password: "equipo-pass-123" });
    expect(res.status).toBe(200);
    expect(res.body.principal.type).toBe("team");
    expect(res.body.principal.team.name).toBe("Aguara");
  });

  it("rechaza una contrasena incorrecta de un equipo", async () => {
    const res = await request(app)
      .post("/api/v1/auth/login")
      .send({ username: "aguara", password: "mal-password" });
    expect(res.status).toBe(401);
  });

  it("no revela si el usuario existe", async () => {
    const [a, b] = await Promise.all([
      request(app).post("/api/v1/auth/login").send({ username: "aguara", password: "x" }),
      request(app).post("/api/v1/auth/login").send({ username: "ninguno", password: "x" }),
    ]);
    expect(a.status).toBe(401);
    expect(b.status).toBe(401);
    expect(a.body.error.message).toBe(b.body.error.message);
  });
});

describe("Proteccion de rutas", () => {
  it("rechaza rutas administrativas sin sesion", async () => {
    const res = await request(app).get("/api/v1/events");
    expect(res.status).toBe(401);
  });

  it("rechaza rutas administrativas para un equipo", async () => {
    const { agent } = await loginAs(app, "aguara", "equipo-pass-123");
    const res = await agent.get("/api/v1/events");
    expect(res.status).toBe(403);

    const team = await prisma.team.findFirstOrThrow({ where: { username: "aguara" } });
    const res2 = await agent.get(`/api/v1/teams/${team.id}`);
    expect(res2.status).toBe(403);
    const res3 = await agent.get("/api/v1/admin/dashboard?eventId=whatever");
    expect(res3.status).toBe(403);
  });

  it("rechaza rutas de equipo para un administrador", async () => {
    const { agent } = await loginAs(app, "root", "s3cret-admin");
    const res = await agent.get("/api/v1/passport");
    expect(res.status).toBe(403);
  });

  it("devuelve la sesion actual con /auth/me", async () => {
    const { agent } = await loginAs(app, "root", "s3cret-admin");
    const res = await agent.get("/api/v1/auth/me");
    expect(res.status).toBe(200);
    expect(res.body.principal.type).toBe("admin");
    expect(res.body.principal.user.username).toBe("root");
  });

  it("permite cerrar sesion", async () => {
    const { agent, csrfToken } = await loginAs(app, "aguara", "equipo-pass-123");
    const out = await agent
      .post("/api/v1/auth/logout")
      .set("x-csrf-token", csrfToken);
    expect(out.status).toBe(200);
    const me = await agent.get("/api/v1/auth/me");
    expect(me.status).toBe(401);
  });
});

describe("Expiracion de sesiones", () => {
  it("invalida la sesion cuando el registro se elimina en el almacen", async () => {
    const { agent } = await loginAs(app, "aguara", "equipo-pass-123");
    await prisma.$executeRawUnsafe(`UPDATE "session" SET expire = NOW() - INTERVAL '1 day'`);
    const res = await agent.get("/api/v1/auth/me");
    expect(res.status).toBe(401);
  });
});