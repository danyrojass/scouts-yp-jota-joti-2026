import { PrismaClient, type ActivityStatus, type ScoringMethod } from "@prisma/client";

const prisma = new PrismaClient();

type SeedActivity = {
  name: string;
  description: string | null;
  scoringMethod: ScoringMethod;
  maxScore: number | null;
  // Estado inicial con el que se crea si no existe. Nunca se pisa el estado de
  // una actividad ya existente (los organizadores lo cambian a mano).
  status: ActivityStatus;
};

// Actividades del ranking general (orden = position). Los nombres son
// editables desde el panel admin; el seed solo crea las faltantes y actualiza
// metadatos sin pisar nombre, estado, publicacion ni `active` existentes.
const ACTIVITIES: SeedActivity[] = [
  {
    name: "Safari de Exploración",
    description: "Checklist colaborativo que los equipos completan durante el evento.",
    scoringMethod: "CHECKLIST",
    maxScore: null,
    status: "PENDING",
  },
  {
    name: "JOTA-JOTI Ypacaraí 2026",
    description: "Caminata de orientación por el recorrido de postas y la ciudad.",
    scoringMethod: "STATIONS",
    // Puntaje maximo con el que se crea la actividad de recorrido: el sistema
    // reparte estos puntos entre las postas resueltas (media por cada saltada).
    maxScore: 80,
    status: "PENDING",
  },
  {
    name: "Conectando con el mundo",
    description: null,
    scoringMethod: "MANUAL",
    maxScore: null,
    status: "PENDING",
  },
  {
    name: "Maestros del código",
    description: null,
    scoringMethod: "MANUAL",
    maxScore: null,
    status: "PENDING",
  },
  {
    name: "Hermandad scout",
    description: null,
    scoringMethod: "MANUAL",
    maxScore: null,
    status: "PENDING",
  },
  {
    name: "Equipo inclusivo",
    description: null,
    scoringMethod: "MANUAL",
    maxScore: null,
    status: "PENDING",
  },
  {
    name: "Embajadores de Paraguay",
    description: null,
    scoringMethod: "MANUAL",
    maxScore: null,
    status: "PENDING",
  },
  {
    name: "Guardianes del planeta",
    description: null,
    scoringMethod: "MANUAL",
    maxScore: null,
    status: "PENDING",
  },
];

/**
 * Carga las actividades del ranking SIN borrar nada: crea las faltantes
 * (emparejando por nombre o por posicion) y actualiza metadatos (descripcion,
 * metodo y orden) de las existentes. Respeta los cambios de nombre, `active`,
 * `status`, `published` y `maxScore` que haya hecho un administrador, y nunca
 * toca `TeamActivityScore`. Idempotente.
 */
async function main() {
  const event =
    (await prisma.event.findFirst({
      where: { status: { in: ["PREPARED", "IN_PROGRESS"] } },
      orderBy: { updatedAt: "desc" },
    })) ?? (await prisma.event.findFirst({ orderBy: { updatedAt: "desc" } }));
  if (!event) {
    // eslint-disable-next-line no-console
    console.error("No hay eventos en la base. Omitido.");
    process.exit(1);
  }

  const existing = await prisma.activity.findMany({ where: { eventId: event.id } });
  const byName = new Map(existing.map((a) => [a.name.trim().toLowerCase(), a]));
  const byPosition = new Map(existing.map((a) => [a.position, a]));

  let created = 0;
  let updated = 0;
  let untouched = 0;

  for (let index = 0; index < ACTIVITIES.length; index++) {
    const def = ACTIVITIES[index];
    const position = index + 1;
    const row =
      byName.get(def.name.trim().toLowerCase()) ?? byPosition.get(position) ?? null;

    if (!row) {
      await prisma.activity.create({
        data: {
          eventId: event.id,
          name: def.name,
          description: def.description,
          scoringMethod: def.scoringMethod,
          maxScore: def.maxScore,
          position,
          status: def.status,
        },
      });
      created++;
      continue;
    }

    // No se pisa el nombre (editable), ni status/published/active, ni un
    // maxScore ya definido. Solo se completa el maxScore cuando esta en null
    // (actividades creadas antes de configurar el valor por defecto).
    const fillMaxScore = row.maxScore === null && def.maxScore !== null;
    const stale =
      row.description !== def.description ||
      row.scoringMethod !== def.scoringMethod ||
      row.position !== position ||
      fillMaxScore;
    if (stale) {
      await prisma.activity.update({
        where: { id: row.id },
        data: {
          description: def.description,
          scoringMethod: def.scoringMethod,
          position,
          ...(fillMaxScore ? { maxScore: def.maxScore } : {}),
        },
      });
      updated++;
    } else {
      untouched++;
    }
  }

  // eslint-disable-next-line no-console
  console.log(`
Actividades del ranking listas (evento: ${event.name}).
- Total definidas: ${ACTIVITIES.length}
- Creadas: ${created} | Actualizadas: ${updated} | Sin cambios: ${untouched}
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
