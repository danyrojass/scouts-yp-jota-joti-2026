import { Router } from "express";
import QRCode from "qrcode";
import { asyncHandler } from "@/utils/asyncHandler";
import { brandQrWithLogo } from "@/utils/qrBrand";
import { requireAdmin } from "@/middleware/auth";
import { csrfProtection } from "@/middleware/csrf";
import { audit } from "@/utils/audit";
import { getPrincipal } from "@/middleware/auth";
import {
  createStationSchema,
  updateStationSchema,
  importStationsSchema,
} from "@/modules/stations/station.validators";
import * as stationService from "@/modules/stations/station.service";

export const stationRoutes = Router();

/**
 * Public (no auth): coarse status of a scanned QR token. Registered before
 * `requireAdmin()` so it stays open to anonymous visitors, and used by the
 * client to invite people to the scout group once the event is over.
 */
stationRoutes.get("/public/:token", asyncHandler(async (req, res) => {
  const status = await stationService.publicTokenStatus(req.params.token);
  res.json({ status });
}));

stationRoutes.use(requireAdmin());

stationRoutes.get("/", asyncHandler(async (req, res) => {
  const eventId = String(req.query.eventId ?? "");
  const stations = await stationService.listStations(eventId);
  res.json({ stations });
}));

stationRoutes.post("/", csrfProtection, asyncHandler(async (req, res) => {
  const data = createStationSchema.parse(req.body);
  const station = await stationService.createStation(data);
  await audit(
    "CREATE",
    "Station",
    station.id,
    { type: "admin", id: getPrincipal(req)!.id },
    { name: station.name, challengeType: station.challengeType },
    { eventId: station.eventId }
  );
  res.status(201).json({ station });
}));

stationRoutes.get("/:id", asyncHandler(async (req, res) => {
  const station = await stationService.getStationById(req.params.id);
  const { expectedAnswer, ...safe } = station;
  void expectedAnswer;
  res.json({ station: safe });
}));

/** Imports coordinates for existing stations from a CSV payload. */
stationRoutes.post("/import", csrfProtection, asyncHandler(async (req, res) => {
  const { eventId, csv } = importStationsSchema.parse(req.body);
  const result = await stationService.importStationsCsv(eventId, csv);
  await audit(
    "IMPORT",
    "Station",
    null,
    { type: "admin", id: getPrincipal(req)!.id },
    { updated: result.updated, errors: result.errors.length },
    { eventId }
  );
  res.json(result);
}));

stationRoutes.patch("/:id", csrfProtection, asyncHandler(async (req, res) => {
  const data = updateStationSchema.parse(req.body);
  const station = await stationService.updateStation(req.params.id, data);
  await audit(
    "UPDATE",
    "Station",
    station.id,
    { type: "admin", id: getPrincipal(req)!.id },
    { changes: { ...data, expectedAnswer: data.expectedAnswer ? "(oculto)" : undefined } },
    { eventId: station.eventId }
  );
  res.json({ station });
}));

stationRoutes.delete("/:id", csrfProtection, asyncHandler(async (req, res) => {
  await stationService.deleteStation(req.params.id);
  await audit("DELETE", "Station", req.params.id, { type: "admin", id: getPrincipal(req)!.id });
  res.status(204).end();
}));

/**
 * Downloads the QR for a station as a printable PNG, with the Grupo Scout 62
 * logo centered as a watermark. Uses the highest error correction level so the
 * centered logo does not hinder scanning.
 */
stationRoutes.get("/:id/qr", asyncHandler(async (req, res) => {
  const station = await stationService.getStationById(req.params.id);
  const url = await stationService.stationQrUrl(station.publicToken);
  const plain = await QRCode.toBuffer(url, {
    type: "png",
    width: 1024,
    margin: 2,
    errorCorrectionLevel: "H",
  });
  let buffer = plain;
  try {
    buffer = brandQrWithLogo(plain);
  } catch {
    buffer = plain;
  }
  res.setHeader("Content-Type", "image/png");
  res.setHeader(
    "Content-Disposition",
    `inline; filename="posta-${station.name.replace(/[^a-z0-9-_]/gi, "_")}.png"`
  );
  res.send(buffer);
}));

/** QR payload data for a station (used by print views / batch download). */
stationRoutes.get("/:id/qr/data", asyncHandler(async (req, res) => {
  const station = await stationService.getStationById(req.params.id);
  res.json({ url: await stationService.stationQrUrl(station.publicToken), token: station.publicToken });
}));