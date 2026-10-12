import { PrismaClient } from "@prisma/client";
import { randomQuestion } from "./questions";

const prisma = new PrismaClient();

/**
 * Asigna, SIN BORRAR NADA, una pregunta aleatoria a una posta aleatoria del
 * itinerario de cada equipo. Es idempotente: primero limpia las preguntas
 * existentes de cada equipo y luego reparte una nueva.
 */
async function main() {
  const teams = await prisma.team.findMany({
    include: { routeStops: { select: { id: true } } },
    orderBy: { createdAt: "asc" },
  });

  if (teams.length === 0) {
    // eslint-disable-next-line no-console
    console.log("No hay equipos. Nada que asignar.");
    return;
  }

  for (const team of teams) {
    await prisma.routeStop.updateMany({
      where: { teamId: team.id },
      data: { question: null, questionAnswer: null },
    });

    if (team.routeStops.length === 0) {
      // eslint-disable-next-line no-console
      console.log(`- ${team.name}: sin postas, se omite.`);
      continue;
    }

    const chosen = team.routeStops[Math.floor(Math.random() * team.routeStops.length)];
    const q = randomQuestion();
    await prisma.routeStop.update({
      where: { id: chosen.id },
      data: { question: q.text, questionAnswer: q.answer ?? null },
    });

    // eslint-disable-next-line no-console
    console.log(`- ${team.name}: "${q.text}"${q.answer ? "" : " (cualquier respuesta)"}`);
  }

  // eslint-disable-next-line no-console
  console.log(`\nPreguntas asignadas a ${teams.length} equipos.`);
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
