import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { randomQuestion } from "./questions";

const prisma = new PrismaClient();

const hash = (plain: string) => bcrypt.hash(plain, 12);

/** Fisher-Yates shuffle (returns a new array). */
function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

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

  // Recorrido real por la ciudad de Ypacaraí. Los 20 puntos se numeran para
  // identificarlos sin ambigüedad (algunos son muy cercanos entre sí). Se cargan
  // como CONFIRMATION (solo escanear para confirmar el paso).
  const REAL_STATIONS = [
    { name: "Ruta PY02 1", latitude: -25.42019689658079, longitude: -57.293242316652325 },
    { name: "Ruta PY02 2", latitude: -25.417155759670393, longitude: -57.294598890604206 },
    { name: "Ruta PY02 3", latitude: -25.41339252405913, longitude: -57.29226291189915 },
    { name: "Ruta PY02 4", latitude: -25.411967483931193, longitude: -57.29137946095978 },
    { name: "Ruta PY02 5", latitude: -25.410773144435932, longitude: -57.290027706503984 },
    { name: "Copetrol 1", latitude: -25.409472377445898, longitude: -57.29035251636475 },
    { name: "Copetrol 2", latitude: -25.409197713903186, longitude: -57.29041122457035 },
    { name: "Supermercado 1", latitude: -25.40763829632697, longitude: -57.290223068510926 },
    { name: "Centro 1", latitude: -25.4061769610061, longitude: -57.28825761326209 },
    { name: "Cooperativa 1", latitude: -25.405990335827017, longitude: -57.28644980991472 },
    { name: "Ferrocarril 1", latitude: -25.404783930431293, longitude: -57.28695156756665 },
    { name: "Ferrocarril 2", latitude: -25.404419562518143, longitude: -57.28661460286067 },
    { name: "Ferrocarril 3", latitude: -25.403517525031322, longitude: -57.28700075950143 },
    { name: "Ferrocarril 4", latitude: -25.403428653971307, longitude: -57.28739921411802 },
    { name: "Ferrocarril 5", latitude: -25.40323758098864, longitude: -57.28736969896229 },
    { name: "Ferrocarril 6", latitude: -25.40306428197522, longitude: -57.286973703956214 },
    { name: "Ferrocarril 7", latitude: -25.402682134547938, longitude: -57.28689991605747 },
    { name: "Ferrocarril 8", latitude: -25.402608815423196, longitude: -57.286530976603935 },
    { name: "Ferrocarril 9", latitude: -25.403219806732892, longitude: -57.286407996788384 },
    { name: "Ferrocarril 10", latitude: -25.402459955253534, longitude: -57.28689991605058 },
  ];

  const stations = await Promise.all(
    REAL_STATIONS.map((s, i) =>
      prisma.station.create({
        data: {
          eventId: event.id,
          name: s.name,
          instructions: "Escanea el QR de la posta y confirma tu paso.",
          challengeType: "CONFIRMATION" as never,
          expectedAnswer: null,
          displayedCode: null,
          latitude: s.latitude,
          longitude: s.longitude,
          publicToken: `posta-${i + 1}-${Buffer.from(s.name)
            .toString("base64url")
            .slice(0, 10)}`,
        },
      })
    )
  );

  // 10 equipos: usuario y nombre visible = "equipo1".."equipo10". Cada equipo
  // recorre una SELECCION aleatoria de 8 postas (subconjunto de las 20), en un
  // orden tambien aleatorio.
  const TEAM_COUNT = 10;
  const STATIONS_PER_TEAM = Number(process.env.TEAM_STATION_COUNT) || 8;
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
    const order = shuffle(stations).slice(0, STATIONS_PER_TEAM);
    await prisma.routeStop.createMany({
      data: order.map((s, pos) => ({
        teamId: team.id,
        stationId: s.id,
        position: pos + 1,
      })),
    });

    // Desafio bonus: una pregunta aleatoria en una de las postas del equipo.
    const stops = await prisma.routeStop.findMany({ where: { teamId: team.id } });
    const chosen = stops[Math.floor(Math.random() * stops.length)];
    const question = randomQuestion();
    await prisma.routeStop.update({
      where: { id: chosen.id },
      data: { question: question.text, questionAnswer: question.answer ?? null },
    });
  }

  // eslint-disable-next-line no-console
  console.log(`
Seed completado.
- Evento: ${event.name} (${event.status})
- Postas: ${stations.length}
- Postas por equipo: ${STATIONS_PER_TEAM} (seleccion aleatoria)
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