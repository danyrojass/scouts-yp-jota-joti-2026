import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

type SeedItem = {
  name: string;
  description: string;
  category: string;
  itemType: string;
  requiresPhoto: boolean;
};

// Checklist oficial del Safari JOTA JOTI 2026 — Ypacaraí. Orden = position.
const CATEGORIES = {
  LUGARES_CULTURA: "LUGARES_CULTURA",
  NATURALEZA: "NATURALEZA",
  OBJETOS_CURIOSIDADES: "OBJETOS_CURIOSIDADES",
  DESAFIOS_FOTOGRAFICOS: "DESAFIOS_FOTOGRAFICOS",
  PREGUNTAS_YPACARAI: "PREGUNTAS_YPACARAI",
} as const;

const ITEMS: SeedItem[] = [
  // A. Lugares y cultura de Ypacaraí
  { name: "Fotografía del tren de Ypacaraí", description: "Buscá el tren que le da identidad a Ypacaraí y fotografialo.", category: CATEGORIES.LUGARES_CULTURA, itemType: "PHOTO", requiresPhoto: true },
  { name: "Fotografía de un castillo", description: "Algunas casas de Ypacaraí imitan castillos. Encontrá una y retratá su fachada.", category: CATEGORIES.LUGARES_CULTURA, itemType: "PHOTO", requiresPhoto: true },
  { name: "Fotografía de la flor de lis en la Plaza de Ypacaraí", description: "Buscá la flor de lis en la plaza principal y registrá dónde está.", category: CATEGORIES.LUGARES_CULTURA, itemType: "PHOTO", requiresPhoto: true },
  { name: "Fotografía de las castañuelas de jacarandá", description: "Las semillas del jacarandá tienen forma de castañuela. Fotografialas bajo el árbol.", category: CATEGORIES.LUGARES_CULTURA, itemType: "PHOTO", requiresPhoto: true },
  { name: "Fotografía de un Ka'i ladrillo", description: "Un ladrillo de adobe, típico de la construcción tradicional paraguaya.", category: CATEGORIES.LUGARES_CULTURA, itemType: "PHOTO", requiresPhoto: true },

  // B. Naturaleza
  { name: "Fotografía de un tajy pytã", description: "El lapacho rosado, árbol nacional del Paraguay. Buscalo y fotografialo.", category: CATEGORIES.NATURALEZA, itemType: "PHOTO", requiresPhoto: true },
  { name: "Fotografía de un pakuri", description: "Árbol frutal típico de la zona. Su fruto tiene cáscara rugosa y carne dulce.", category: CATEGORIES.NATURALEZA, itemType: "PHOTO", requiresPhoto: true },
  { name: "Fotografía de un jacarandá", description: "Conocido por sus flores lilas y sus hojas con forma de helicóptero.", category: CATEGORIES.NATURALEZA, itemType: "PHOTO", requiresPhoto: true },
  { name: "Fotografía de un tajy hũ", description: "El lapacho negro o morado: flores grandes, corteza leñosa y copa amplia.", category: CATEGORIES.NATURALEZA, itemType: "PHOTO", requiresPhoto: true },
  { name: "Fotografía de una tipa", description: "Árbol de porte grande muy usado como sombra en plazas y calles.", category: CATEGORIES.NATURALEZA, itemType: "PHOTO", requiresPhoto: true },
  { name: "Recolectar cinco hojas de cinco especies de árboles diferentes, sin dañar las plantas", description: "Usá únicamente hojas caídas del suelo. Elegí cinco especies distintas e identificá cada una antes de recolectarla. No arranques hojas de los árboles.", category: CATEGORIES.NATURALEZA, itemType: "COLLECTION", requiresPhoto: true },
  { name: "Fotografía de hojas con forma de helicóptero", description: "Las sámaras del jacarandá flotan girando al caer. Buscá una y fotografiá su forma.", category: CATEGORIES.NATURALEZA, itemType: "PHOTO", requiresPhoto: true },

  // C. Objetos y curiosidades
  { name: "Conseguir un boleto de colectivo", description: "Guardá un boleto de colectivo de Ypacaraí.", category: CATEGORIES.OBJETOS_CURIOSIDADES, itemType: "OBJECT", requiresPhoto: false },
  { name: "Fotografía con alguien disfrazado de Scooby-Doo", description: "Si hay alguien disfrazado y acepta participar, sacate una foto con esa persona. Solo con su consentimiento.", category: CATEGORIES.OBJETOS_CURIOSIDADES, itemType: "PHOTO", requiresPhoto: true },
  { name: "Fotografía de algo relacionado con The Beatles", description: "Buscá y fotografiá algo que recuerde a The Beatles: una canción, un mural, una remera...", category: CATEGORIES.OBJETOS_CURIOSIDADES, itemType: "PHOTO", requiresPhoto: true },
  { name: "Contar los aros de básquetbol que encuentren y registrar la cantidad", description: "Contá cuántos aros de básquetbol ven en todo el recorrido y registrá el total.", category: CATEGORIES.OBJETOS_CURIOSIDADES, itemType: "NUMERIC", requiresPhoto: false },
  { name: "Fotografía de una cabina telefónica, si encuentran una", description: "Si hay alguna cabina telefónica en el recorrido, fotografiala. Es opcional.", category: CATEGORIES.OBJETOS_CURIOSIDADES, itemType: "PHOTO", requiresPhoto: true },
  { name: "Conseguir una tapa verde de bolígrafo Bic", description: "Encontrá una tapa verde de bolígrafo Bic (usada está bien).", category: CATEGORIES.OBJETOS_CURIOSIDADES, itemType: "OBJECT", requiresPhoto: false },
  { name: "Conseguir una moneda de 500 guaraníes o menos", description: "Cualquier moneda menor o igual a 500 guaraníes.", category: CATEGORIES.OBJETOS_CURIOSIDADES, itemType: "OBJECT", requiresPhoto: false },
  { name: "Conseguir una bolsa de supermercado de Ypacaraí", description: "Una bolsa de un supermercado o comercio de Ypacaraí.", category: CATEGORIES.OBJETOS_CURIOSIDADES, itemType: "OBJECT", requiresPhoto: false },
  { name: "Conseguir una flor de papel", description: "Una flor hecha de papel, que puede crear el propio equipo.", category: CATEGORIES.OBJETOS_CURIOSIDADES, itemType: "OBJECT", requiresPhoto: false },
  { name: "Encontrar un fósforo usado y uno sin usar, sin encenderlos", description: "Un fósforo usado y otro sin usar. NO los enciendas ni los arrojes al suelo.", category: CATEGORIES.OBJETOS_CURIOSIDADES, itemType: "OBJECT", requiresPhoto: false },

  // D. Desafíos fotográficos
  { name: "Fotografía de un elemento que represente el espíritu scout", description: "Algo que para el equipo represente el espíritu scout: una promesa, un símbolo, una actitud...", category: CATEGORIES.DESAFIOS_FOTOGRAFICOS, itemType: "PHOTO", requiresPhoto: true },
  { name: "Fotografía creativa de todo el equipo durante la exploración", description: "Un retrato creativo con todos los integrantes del equipo.", category: CATEGORIES.DESAFIOS_FOTOGRAFICOS, itemType: "PHOTO", requiresPhoto: true },

  // E. Preguntas sobre Ypacaraí (respuesta escrita, se registra como observación)
  { name: "¿Cuánto cuesta una estampilla de correo?", description: "Averiguá en la oficina de correos de Ypacaraí el precio de una estampilla y registralo.", category: CATEGORIES.PREGUNTAS_YPACARAI, itemType: "QUESTION", requiresPhoto: false },
  { name: "¿Cómo se llama la parroquia de Ypacaraí y cómo se llama el cura párroco?", description: "Averiguá el nombre de la parroquia principal de Ypacaraí y el de su cura párroco.", category: CATEGORIES.PREGUNTAS_YPACARAI, itemType: "QUESTION", requiresPhoto: false },
  { name: "¿Cómo se llama la Casa de la Cultura y los restos de quiénes descansaban allí?", description: "Averiguá el nombre de la Casa de la Cultura de Ypacaraí y de quiénes eran los restos que descansaban allí.", category: CATEGORIES.PREGUNTAS_YPACARAI, itemType: "QUESTION", requiresPhoto: false },
  { name: "¿Qué tres calles pasan por la plaza de Ypacaraí?", description: "Observá la plaza principal y anotá el nombre de tres calles que pasan por ella.", category: CATEGORIES.PREGUNTAS_YPACARAI, itemType: "QUESTION", requiresPhoto: false },
  { name: "¿Cómo se llama el paseo cercano a la estación del tren y cómo se le dice coloquialmente al tren?", description: "Averiguá el nombre del paseo junto a la estación del tren y el apodo coloquial de ese tren.", category: CATEGORIES.PREGUNTAS_YPACARAI, itemType: "QUESTION", requiresPhoto: false },
  { name: "¿Cuánto cuesta una hamburguesa \"El Inglés\" del restaurant E60?", description: "Averiguá el precio de la hamburguesa \"El Inglés\" en el restaurant E60 de Ypacaraí y registralo.", category: CATEGORIES.PREGUNTAS_YPACARAI, itemType: "QUESTION", requiresPhoto: false },
];

const SAFARI_TITLE = "Safari JOTA JOTI 2026 — Ypacaraí";
const SAFARI_DESCRIPTION =
  "¡Exploradores, llegó el momento de descubrir Ypacaraí! Completen los desafíos del safari, observen su entorno, encuentren curiosidades y registren sus descubrimientos mediante fotografías y objetos recolectados. Trabajen en equipo, respeten el entorno y sigan las indicaciones de la organización.";

/**
 * Carga la checklist oficial SIN borrar nada: crea el safari si no existe,
 * crea los elementos faltantes y actualiza metadatos (descripción, categoría,
 * tipo, orden, requiereFoto) de los ya existentes. Respeta `active` y nunca
 * toca `SafariFind`. Idempotente: se puede correr varias veces.
 */
async function main() {
  const event = await prisma.event.findFirst({
    where: { status: { in: ["PREPARED", "IN_PROGRESS"] } },
    orderBy: { updatedAt: "desc" },
  }) ?? await prisma.event.findFirst({ orderBy: { updatedAt: "desc" } });
  if (!event) {
    // eslint-disable-next-line no-console
    console.error("No hay eventos en la base. Omitido.");
    process.exit(1);
  }

  const safari =
    (await prisma.safari.findUnique({ where: { eventId: event.id } })) ??
    (await prisma.safari.create({
      data: { eventId: event.id, title: SAFARI_TITLE, description: SAFARI_DESCRIPTION },
    }));
  if (safari.title !== SAFARI_TITLE || safari.description !== SAFARI_DESCRIPTION) {
    await prisma.safari.update({
      where: { id: safari.id },
      data: { title: SAFARI_TITLE, description: SAFARI_DESCRIPTION },
    });
  }

  const existing = await prisma.safariItem.findMany({ where: { safariId: safari.id } });
  const byName = new Map(existing.map((i) => [i.name.trim().toLowerCase(), i]));

  let created = 0;
  let updated = 0;
  let untouched = 0;
  for (let index = 0; index < ITEMS.length; index++) {
    const item = ITEMS[index];
    const position = index + 1;
    const row = byName.get(item.name.trim().toLowerCase());
    if (!row) {
      await prisma.safariItem.create({
        data: {
          safariId: safari.id,
          name: item.name,
          description: item.description,
          position,
          active: true,
          category: item.category,
          itemType: item.itemType,
          requiresPhoto: item.requiresPhoto,
        },
      });
      created++;
      continue;
    }

    const stale =
      row.name !== item.name ||
      row.description !== item.description ||
      row.position !== position ||
      row.category !== item.category ||
      row.itemType !== item.itemType ||
      row.requiresPhoto !== item.requiresPhoto;
    if (stale) {
      // Se preserva `row.active`: los organizadores pueden desactivar elementos.
      await prisma.safariItem.update({
        where: { id: row.id },
        data: {
          name: item.name,
          description: item.description,
          position,
          category: item.category,
          itemType: item.itemType,
          requiresPhoto: item.requiresPhoto,
        },
      });
      updated++;
    } else {
      untouched++;
    }
  }

  // eslint-disable-next-line no-console
  console.log(`
Safari listo (evento: ${event.name}).
- Safari: ${SAFARI_TITLE} (${safari.id})
- Elementos totales: ${ITEMS.length}
- Creados: ${created} | Actualizados: ${updated} | Sin cambios: ${untouched}
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