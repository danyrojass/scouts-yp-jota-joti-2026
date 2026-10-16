import { randomBytes } from "node:crypto";
import type { ChallengeType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ApiError } from "@/utils/errors";
import { env } from "@/config/env";
import { parseCoordinate } from "@/utils/geo";

export function generatePublicToken() {
  return randomBytes(12).toString("base64url");
}

/** Sanitizes the values that must never leave the server before answering. */
export function toPublicStation(station: {
  id: string;
  name: string;
  description: string | null;
  instructions: string | null;
  displayedCode: string | null;
  challengeType: ChallengeType;
  autoAcceptAny: boolean;
  active: boolean;
}) {
  return {
    id: station.id,
    name: station.name,
    description: station.description,
    instructions: station.instructions,
    challengeType: station.challengeType,
    autoAcceptAny: station.autoAcceptAny,
    showDisplayedCode: !station.active && station.challengeType === "CODE" ? station.displayedCode : null,
  };
}

async function uniqueToken(): Promise<string> {
  for (let i = 0; i < 5; i++) {
    const token = generatePublicToken();
    const existing = await prisma.station.findUnique({ where: { publicToken: token } });
    if (!existing) return token;
  }
  throw ApiError.conflict("No se pudo generar un token unico para la posta");
}

function validateChallenge(
  challengeType: ChallengeType,
  expectedAnswer: string | null | undefined,
  autoAcceptAny: boolean
) {
  if (challengeType === "CONFIRMATION") return;
  if (challengeType === "AUTO" && (autoAcceptAny || !expectedAnswer)) return;
  if (!expectedAnswer || expectedAnswer.trim() === "") {
    throw ApiError.badRequest(
      "Este tipo de desafio requiere una respuesta esperada"
    );
  }
}

export async function listStations(eventId: string) {
  return prisma.station.findMany({
    where: { eventId },
    orderBy: { name: "asc" },
    include: { _count: { select: { visits: true } } },
  });
}

export async function createStation(data: {
  eventId: string;
  name: string;
  description?: string | null;
  challengeType: ChallengeType;
  instructions?: string | null;
  displayedCode?: string | null;
  expectedAnswer?: string | null;
  rescuePhrase?: string | null;
  autoAcceptAny: boolean;
  active: boolean;
  latitude?: number | null;
  longitude?: number | null;
}) {
  const event = await prisma.event.findUnique({ where: { id: data.eventId } });
  if (!event) throw ApiError.notFound("Evento no encontrado");

  validateChallenge(data.challengeType, data.expectedAnswer, data.autoAcceptAny);

  const station = await prisma.station.create({
    data: {
      eventId: data.eventId,
      name: data.name,
      description: data.description,
      publicToken: await uniqueToken(),
      challengeType: data.challengeType,
      instructions: data.instructions,
      displayedCode: data.challengeType === "CODE" ? data.displayedCode : null,
      expectedAnswer:
        data.challengeType === "CONFIRMATION" ? null : data.expectedAnswer,
      rescuePhrase: data.rescuePhrase?.trim() || null,
      autoAcceptAny: data.challengeType === "AUTO" ? data.autoAcceptAny : false,
      active: data.active,
      latitude: data.latitude ?? null,
      longitude: data.longitude ?? null,
    },
  });

  return station;
}

export async function getStationById(id: string) {
  const station = await prisma.station.findUnique({
    where: { id },
    include: { event: { select: { id: true, name: true, status: true } } },
  });
  if (!station) throw ApiError.notFound("Posta no encontrada");
  return station;
}

export async function updateStation(id: string, data: {
  name?: string;
  description?: string | null;
  challengeType?: ChallengeType;
  instructions?: string | null;
  displayedCode?: string | null;
  expectedAnswer?: string | null;
  rescuePhrase?: string | null;
  autoAcceptAny?: boolean;
  active?: boolean;
  latitude?: number | null;
  longitude?: number | null;
}) {
  const station = await getStationById(id);

  const next = {
    name: data.name ?? station.name,
    description: data.description !== undefined ? data.description : station.description,
    challengeType: data.challengeType ?? station.challengeType,
    instructions: data.instructions !== undefined ? data.instructions : station.instructions,
    expectedAnswer: data.expectedAnswer !== undefined ? data.expectedAnswer : station.expectedAnswer,
    rescuePhrase:
      data.rescuePhrase !== undefined ? data.rescuePhrase?.trim() || null : station.rescuePhrase,
    autoAcceptAny: data.autoAcceptAny !== undefined ? data.autoAcceptAny : station.autoAcceptAny,
    displayedCode: data.displayedCode !== undefined ? data.displayedCode : station.displayedCode,
    active: data.active !== undefined ? data.active : station.active,
    latitude: data.latitude !== undefined ? data.latitude : station.latitude,
    longitude: data.longitude !== undefined ? data.longitude : station.longitude,
  };

  if (next.challengeType === "CONFIRMATION") {
    next.expectedAnswer = null;
    next.autoAcceptAny = false;
    next.displayedCode = null;
  } else if (next.challengeType === "CODE") {
    next.displayedCode = next.displayedCode ?? station.displayedCode;
  } else {
    next.displayedCode = null;
  }

  validateChallenge(next.challengeType, next.expectedAnswer, next.autoAcceptAny);

  return prisma.station.update({ where: { id }, data: next });
}

export async function deleteStation(id: string) {
  const station = await getStationById(id);
  if (station.event.status === "IN_PROGRESS") {
    throw ApiError.forbidden(
      "No se puede eliminar una posta mientras el evento esta en curso"
    );
  }
  await prisma.station.delete({ where: { id } });
}

export async function stationQrUrl(publicToken: string) {
  return `${env.PUBLIC_BASE_URL}/posta/${publicToken}`;
}

export type PublicTokenStatus = "OPEN" | "CLOSED" | "NOT_FOUND";

/**
 * Coarse, unauthenticated status for a scanned QR token. Lets the client show
 * the "¡Ven a conocernos!" invitation (and a login prompt while the event is
 * open) without exposing any station secrets.
 */
export async function publicTokenStatus(publicToken: string): Promise<PublicTokenStatus> {
  const station = await prisma.station.findUnique({
    where: { publicToken },
    select: { event: { select: { status: true } } },
  });
  if (!station) return "NOT_FOUND";
  const closed =
    station.event.status === "FINISHED" || station.event.status === "CANCELLED";
  return closed ? "CLOSED" : "OPEN";
}

// ---------------------------------------------------------------------------
// CSV coordinate import
// ---------------------------------------------------------------------------

export type ImportRowError = { row: number; error: string };

export type ImportResult = {
  updated: number;
  errors: ImportRowError[];
  parsed: number;
};

function detectDelimiter(line: string): string {
  if (line.includes("\t")) return "\t";
  if (line.includes(";") && line.split(";").length >= line.split(",").length) {
    return ";";
  }
  return ",";
}

/** Minimal RFC4180-ish CSV parser (quotes, escaped quotes, CRLF). */
function parseCsv(text: string, delimiter: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  const pushField = () => {
    row.push(field);
    field = "";
  };
  const pushRow = () => {
    rows.push(row);
    row = [];
  };

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
    } else if (ch === delimiter) {
      pushField();
    } else if (ch === "\n") {
      pushField();
      pushRow();
    } else if (ch !== "\r") {
      field += ch;
    }
  }
  if (field.length > 0 || row.length > 0) {
    pushField();
    pushRow();
  }
  return rows.filter((r) => r.some((c) => c.trim().length > 0));
}

/**
 * Imports coordinates for existing stations. Columns:
 *   nombre, qr_id, latitud, longitud, descripcion
 * `qr_id` is optional and matches the station's public token or displayed code.
 * Rows that do not match an existing station are reported as errors instead of
 * creating new stations, so the import is safe to run repeatedly.
 */
export async function importStationsCsv(
  eventId: string,
  csv: string
): Promise<ImportResult> {
  const event = await prisma.event.findUnique({ where: { id: eventId } });
  if (!event) throw ApiError.notFound("Evento no encontrado");

  const cleaned = csv.replace(/^\uFEFF/, "");
  const lines = cleaned
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split("\n")
    .filter((l) => l.trim().length > 0);
  if (lines.length === 0) throw ApiError.badRequest("El CSV est\u00e1 vac\u00edo");

  const records = parseCsv(cleaned, detectDelimiter(lines[0]));

  let start = 0;
  const first = records[0];
  if (first && /^(nombre|name)$/i.test((first[0] ?? "").trim())) start = 1;

  const stations = await prisma.station.findMany({ where: { eventId } });
  const byName = new Map(stations.map((s) => [s.name.trim().toLowerCase(), s]));
  const byCode = new Map<string, (typeof stations)[number]>();
  for (const s of stations) {
    byCode.set(s.publicToken, s);
    if (s.displayedCode) byCode.set(s.displayedCode.trim().toLowerCase(), s);
  }

  const errors: ImportRowError[] = [];
  let updated = 0;

  for (let i = start; i < records.length; i++) {
    const rowNumber = i + 1;
    const cells = records[i].map((c) => c.trim());
    const name = cells[0] ?? "";
    const qrId = cells[1] ?? "";
    const description = cells[4] ?? "";

    if (!name && !qrId) {
      errors.push({ row: rowNumber, error: "Falta el nombre de la posta" });
      continue;
    }

    const latitude = parseCoordinate(cells[2] ?? "");
    const longitude = parseCoordinate(cells[3] ?? "");
    if (latitude === null || latitude < -90 || latitude > 90) {
      errors.push({ row: rowNumber, error: `Latitud inv\u00e1lida: "${cells[2] ?? ""}"` });
      continue;
    }
    if (longitude === null || longitude < -180 || longitude > 180) {
      errors.push({ row: rowNumber, error: `Longitud inv\u00e1lida: "${cells[3] ?? ""}"` });
      continue;
    }

    const station =
      (qrId ? byCode.get(qrId) ?? byCode.get(qrId.toLowerCase()) : undefined) ??
      byName.get(name.trim().toLowerCase());
    if (!station) {
      errors.push({
        row: rowNumber,
        error: `No se encontr\u00f3 una posta existente para "${name || qrId}"`,
      });
      continue;
    }

    await prisma.station.update({
      where: { id: station.id },
      data: {
        latitude,
        longitude,
        ...(description ? { description } : {}),
      },
    });
    updated++;
  }

  return { updated, errors, parsed: records.length - start };
}
