import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const hash = (plain: string) => bcrypt.hash(plain, 12);

async function main() {
  const existing = await prisma.event.count();
  if (existing > 0) {
    // eslint-disable-next-line no-console
    console.log("La base ya contiene datos. Seed omitido.");
    return;
  }

  // eslint-disable-next-line no-console
  console.log("Sembrando datos de demostracion...");

  const event = await prisma.event.create({
    data: {
      name: "Exploracion de Ypacarai 2026",
      description:
        "Carrera de orientacion por postas con codigos QR en la Reserva Natural de Ypacarai.",
      date: new Date("2026-11-14T08:00:00.000Z"),
      location: "Reserva Natural de Ypacarai, Paraguay",
      status: "PREPARED",
    },
  });

  const adminUsername = process.env.ADMIN_USERNAME || "admin";
  const adminPasswordHash = await hash(process.env.ADMIN_PASSWORD || "admin12345");
  await prisma.user.upsert({
    where: { username: adminUsername },
    update: { passwordHash: adminPasswordHash, active: true },
    create: { username: adminUsername, passwordHash: adminPasswordHash, role: "ADMIN" },
  });

  // Approximate demo coordinates around the Ypacaraí lake shore. They are only
  // illustrative placeholders; real coordinates are loaded by an admin.
  const DEMO_COORDS = [
    { latitude: -25.3903, longitude: -57.2859 },
    { latitude: -25.3931, longitude: -57.2792 },
    { latitude: -25.3995, longitude: -57.2871 },
    { latitude: -25.4058, longitude: -57.2906 },
    { latitude: -25.4112, longitude: -57.2834 },
  ];

  const stations = await Promise.all(
    [
      {
        name: "Mirador del Lago",
        description: "Posta con vista panoramica al lago Ypacarai.",
        instructions: "Busca la palabra clave pintada en el cartel de madera.",
        challengeType: "CODE",
        expectedAnswer: "TATACUA",
        displayedCode: "Palabra clave: ingresa la palabra del cartel.",
      },
      {
        name: "Sendero del Jaguarete",
        description: "Posta en la entrada del sendero principal.",
        instructions: "Responde: ¿Cuantas patas tiene el jaguarete en el logo?",
        challengeType: "QUESTION",
        expectedAnswer: "cuatro",
      },
      {
        name: "Laguna Verde",
        description: "Confirmacion de paso por la laguna.",
        instructions: "Escanea y confirma tu paso por la Laguna Verde.",
        challengeType: "CONFIRMATION",
      },
      {
        name: "Monte de los Lobos",
        description: "Posta junto a la fauna local.",
        instructions: "Completa el refran: 'Lobo que...'",
        challengeType: "QUESTION",
        expectedAnswer: "aulla no muerde",
      },
      {
        name: "Cueva del Zorro",
        description: "Ultima posta antes de la meta.",
        instructions: "Escribe la clave final oculta en la roca.",
        challengeType: "CODE",
        expectedAnswer: "GUARANI",
        displayedCode: "Clave: la encuentras debajo de la roca grande.",
      },
    ].map((s, i) =>
      prisma.station.create({
        data: {
          eventId: event.id,
          name: s.name,
          description: s.description,
          instructions: s.instructions,
          challengeType: s.challengeType as never,
          expectedAnswer: (s as { expectedAnswer?: string }).expectedAnswer ?? null,
          displayedCode: (s as { displayedCode?: string }).displayedCode ?? null,
          latitude: DEMO_COORDS[i]?.latitude ?? null,
          longitude: DEMO_COORDS[i]?.longitude ?? null,
          publicToken: `demo-station-${i + 1}-${Buffer.from(s.name)
            .toString("base64url")
            .slice(0, 10)}`,
        },
      })
    )
  );

  // 10 equipos: usuario y nombre visible = "equipo1".."equipo10". Cada equipo
  // recorre las MISMAS postas en un orden rotado, para que no compartan ruta.
  const TEAM_COUNT = 10;
  const TEAM_PASSWORD = process.env.TEAM_PASSWORD || "explora2026";

  for (let i = 0; i < TEAM_COUNT; i++) {
    const name = `equipo${i + 1}`;
    const team = await prisma.team.create({
      data: {
        eventId: event.id,
        name,
        username: name,
        passwordHash: await hash(TEAM_PASSWORD),
        active: true,
      },
    });
    const order = stations.map((_, k) => (i + k) % stations.length);
    await prisma.routeStop.createMany({
      data: order.map((idx, pos) => ({
        teamId: team.id,
        stationId: stations[idx].id,
        position: pos + 1,
      })),
    });
  }

  // eslint-disable-next-line no-console
  console.log(`
Seed completado.
- Evento: ${event.name} (${event.status})
- Postas: ${stations.length}
- Equipos: equipo1..equipo${TEAM_COUNT}  (contrasena: ${TEAM_PASSWORD})
- Admin: ${adminUsername}
`);
}

main()
  .catch((e) => {
    // eslint-disable-next-line no-console
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });