import { PrismaClient } from "@prisma/client";
import { randomAnsweredQuestion, randomAnyQuestion } from "./questions";

const prisma = new PrismaClient();

/** Picks two distinct random indexes in [0, length). */
function twoDistinct(length: number): [number, number] {
  const a = Math.floor(Math.random() * length);
  let b = Math.floor(Math.random() * (length - 1));
  if (b >= a) b++;
  return [a, b];
}

/**
 * Asigna, SIN BORRAR NADA, 2 preguntas aleatorias a cada equipo en dos de sus
 * postas: una con respuesta correcta (QUESTION) y otra de respuesta libre (AUTO).
 * Es idempotente: primero limpia las preguntas existentes de cada equipo.
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

    if (team.routeStops.length < 2) {
      // eslint-disable-next-line no-console
      console.log(`- ${team.name}: tiene menos de 2 postas, se omite.`);
      continue;
    }

    const [i, j] = twoDistinct(team.routeStops.length);
    const answered = randomAnsweredQuestion();
    const anyQ = randomAnyQuestion();

    await prisma.routeStop.update({
      where: { id: team.routeStops[i].id },
      data: { question: answered.text, questionAnswer: answered.answer ?? null },
    });
    await prisma.routeStop.update({
      where: { id: team.routeStops[j].id },
      data: { question: anyQ.text, questionAnswer: null },
    });

    // eslint-disable-next-line no-console
    console.log(`- ${team.name}:\n    [acierto] "${answered.text}"\n    [libre]   "${anyQ.text}"`);
  }

  // eslint-disable-next-line no-console
  console.log(`\n2 preguntas asignadas a ${teams.length} equipos.`);
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
