import { beforeAll, describe, expect, it } from "vitest";
import {
  addTeam,
  createAdmin,
  createApp,
  loginAs,
  seedFixture,
  type Fixture,
} from "./helpers";
import { prisma } from "@/lib/prisma";

const app = createApp();
let fx: Fixture;

beforeAll(async () => {
  fx = await seedFixture([]);
  await createAdmin("memberadmin", "member-admin-pass");
});

describe("Integrantes (beneficiarios)", () => {
  it("crea, lista, edita y elimina integrantes", async () => {
    const { agent, csrfToken } = await loginAs(app, "memberadmin", "member-admin-pass");

    const create = await agent
      .post("/api/v1/members")
      .set("x-csrf-token", csrfToken)
      .send({
        eventId: fx.eventId,
        firstName: "Ana",
        lastName: "Perez",
        document: "123456",
        role: "SCOUT",
      });
    expect(create.status).toBe(201);
    const id = create.body.member.id;

    const list = await agent.get(`/api/v1/members?eventId=${fx.eventId}`);
    const created = list.body.members.find((m: { id: string }) => m.id === id);
    expect(created).toBeTruthy();
    expect(created.lastName).toBe("Perez");

    const upd = await agent
      .patch(`/api/v1/members/${id}`)
      .set("x-csrf-token", csrfToken)
      .send({ role: "DIRIGENTE", phone: "0981-000000" });
    expect(upd.body.member.role).toBe("DIRIGENTE");
    expect(upd.body.member.phone).toBe("0981-000000");

    const del = await agent
      .delete(`/api/v1/members/${id}`)
      .set("x-csrf-token", csrfToken);
    expect(del.status).toBe(204);
  });

  it("rechaza documento duplicado en el mismo evento", async () => {
    const { agent, csrfToken } = await loginAs(app, "memberadmin", "member-admin-pass");
    const payload = { eventId: fx.eventId, firstName: "B", lastName: "C", document: "dup-1" };

    const first = await agent.post("/api/v1/members").set("x-csrf-token", csrfToken).send(payload);
    expect(first.status).toBe(201);

    const dup = await agent
      .post("/api/v1/members")
      .set("x-csrf-token", csrfToken)
      .send({ ...payload, firstName: "D", lastName: "E" });
    expect(dup.status).toBe(409);
  });

  it("asigna un integrante a un equipo del evento", async () => {
    const team = await addTeam(fx.eventId, "m-team", "Equipo M", [fx.stations[0].id]);
    const { agent, csrfToken } = await loginAs(app, "memberadmin", "member-admin-pass");

    const res = await agent
      .post("/api/v1/members")
      .set("x-csrf-token", csrfToken)
      .send({
        eventId: fx.eventId,
        teamId: team.id,
        firstName: "Luis",
        lastName: "Gomez",
      });
    expect(res.status).toBe(201);
    expect(res.body.member.team.id).toBe(team.id);
  });

  it("rechaza asignar un equipo de otro evento", async () => {
    const other = await seedFixture([]);
    const otherTeam = other.teams[0];
    void otherTeam;
    const alien = await addTeam(other.eventId, "m-alien", "Ajeno", [other.stations[0].id]);

    const { agent, csrfToken } = await loginAs(app, "memberadmin", "member-admin-pass");
    const res = await agent
      .post("/api/v1/members")
      .set("x-csrf-token", csrfToken)
      .send({
        eventId: fx.eventId,
        teamId: alien.id,
        firstName: "Error",
        lastName: "Cross",
      });
    expect(res.status).toBe(400);
  });

  it("requiere sesión de administrador", async () => {
    const team = fx.teams[0];
    void team;
    await addTeam(fx.eventId, "m-plain", "Plain", [fx.stations[0].id]);
    const { agent } = await loginAs(app, "m-plain", "equipo-pass-123");
    const res = await agent.get(`/api/v1/members?eventId=${fx.eventId}`);
    expect([401, 403]).toContain(res.status);
  });
});
