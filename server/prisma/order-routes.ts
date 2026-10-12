import { PrismaClient } from "@prisma/client";
import { routeIndex } from "./route";

const prisma = new PrismaClient();

/**
 * Reordena, SIN BORRAR NADA, las postas de cada equipo segun el orden
 * geografico canonico (ver ./route.ts). No cambia el subconjunto de postas ni
 * las preguntas bonus: solo su `position`, para que el recorrido no vaya y
 * vuelva por el mismo tramo. Idempotente.
 */
async function main() {
  const teams = await prisma.team.findMany({
    include: {
      routeStops: {
        include: { station: { select: { name: true, latitude: true, longitude: true } } },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  for (const team of teams) {
    if (team.routeStops.length < 2) {
      // eslint-disable-next-line no-console
      console.log(`- ${team.name}: menos de 2 postas, se omite.`);
      continue;
    }

    const sorted = [...team.routeStops].sort((a, b) => {
      const ia = routeIndex(a.station.latitude, a.station.longitude);
      const ib = routeIndex(b.station.latitude, b.station.longitude);
      return (ia === -1 ? Number.MAX_SAFE_INTEGER : ia) - (ib === -1 ? Number.MAX_SAFE_INTEGER : ib);
    });

    await prisma.$transaction(async (tx) => {
      // Posiciones negativas temporales para no chocar con @@unique([teamId, position]).
      for (let i = 0; i < sorted.length; i++) {
        await tx.routeStop.update({ where: { id: sorted[i].id }, data: { position: -(i + 1) } });
      }
      for (let i = 0; i < sorted.length; i++) {
        await tx.routeStop.update({ where: { id: sorted[i].id }, data: { position: i + 1 } });
      }
    });

    // eslint-disable-next-line no-console
    console.log(`- ${team.name}: ${sorted.map((s) => s.station.name).join(" -> ")}`);
  }

  // eslint-disable-next-line no-console
  console.log(`\nRutas reordenadas para ${teams.length} equipos.`);
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
