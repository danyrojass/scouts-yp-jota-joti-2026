import { useEffect, useMemo } from "react";
import { MapContainer, TileLayer, Marker, Polyline, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { PassportStop } from "@/api/types";

export type StopStatus = "COMPLETED" | "SKIPPED" | "NEXT" | "PENDING";

export function stopStatus(
  stop: PassportStop,
  nextPosition: number | null,
  done: boolean
): StopStatus {
  if (stop.completed) return "COMPLETED";
  if (stop.skipped) return "SKIPPED";
  if (!done && nextPosition !== null && stop.position === nextPosition) return "NEXT";
  return "PENDING";
}

const STATUS_COLOR: Record<StopStatus, string> = {
  COMPLETED: "#15803d",
  SKIPPED: "#b45309",
  NEXT: "#c2410c",
  PENDING: "#a8a29e",
};

const STATUS_LABEL: Record<StopStatus, string> = {
  COMPLETED: "Completada",
  SKIPPED: "Saltada",
  NEXT: "Próxima",
  PENDING: "Pendiente",
};

function numberIcon(n: number, status: StopStatus) {
  const color = STATUS_COLOR[status];
  return L.divIcon({
    className: "itinerary-marker",
    html: `<div style="background:${color};color:#fff;width:30px;height:30px;border-radius:9999px;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:14px;border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.35)">${n}</div>`,
    iconSize: [30, 30],
    iconAnchor: [15, 15],
    popupAnchor: [0, -16],
  });
}

function flagIcon(label: string, color: string) {
  return L.divIcon({
    className: "itinerary-marker",
    html: `<div style="background:${color};color:#fff;width:34px;height:34px;border-radius:10px;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:15px;border:2px solid #fff;box-shadow:0 1px 5px rgba(0,0,0,.4)">${label}</div>`,
    iconSize: [34, 34],
    iconAnchor: [17, 17],
    popupAnchor: [0, -18],
  });
}

function FitBounds({ positions }: { positions: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    if (positions.length === 0) return;
    if (positions.length === 1) {
      map.setView(positions[0], 15);
      return;
    }
    map.fitBounds(L.latLngBounds(positions), { padding: [40, 40] });
  }, [map, positions]);
  return null;
}

export function ItineraryMap({
  stops,
  nextPosition,
  done,
}: {
  stops: PassportStop[];
  nextPosition: number | null;
  done: boolean;
}) {
  const coords = useMemo(
    () =>
      stops
        .filter((s) => s.latitude != null && s.longitude != null)
        .map((s) => ({ stop: s, lat: s.latitude as number, lng: s.longitude as number })),
    [stops]
  );

  const positions = useMemo(
    () => coords.map((c) => [c.lat, c.lng] as [number, number]),
    [coords]
  );

  if (coords.length === 0) {
    return (
      <div className="card text-center">
        <p className="font-bold text-forest-700">El mapa estará disponible cuando las postas tengan ubicación.</p>
        <p className="mt-1 text-sm font-semibold text-forest-500">
          Mientras tanto, seguí la lista de abajo.
        </p>
      </div>
    );
  }

  const center = positions[0];
  const boundsKey = positions.map((p) => p.join(",")).join("|");
  const first = coords[0];
  const last = coords[coords.length - 1];

  return (
    <div className="card overflow-hidden p-0">
      <div className="h-72 w-full">
        <MapContainer
          center={center}
          zoom={14}
          scrollWheelZoom={false}
          style={{ height: "100%", width: "100%" }}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          {positions.length > 1 && (
            <Polyline positions={positions} pathOptions={{ color: "#c2410c", weight: 3, dashArray: "6 8" }} />
          )}
          {coords.map(({ stop, lat, lng }) => {
            const status = stopStatus(stop, nextPosition, done);
            return (
              <Marker key={stop.stationId} position={[lat, lng]} icon={numberIcon(stop.position, status)}>
                <Popup>
                  <strong>{stop.name}</strong>
                  <br />
                  {STATUS_LABEL[status]}
                  {stop.mapsUrl && (
                    <>
                      <br />
                      <a href={stop.mapsUrl} target="_blank" rel="noreferrer">
                        Cómo llegar
                      </a>
                    </>
                  )}
                </Popup>
              </Marker>
            );
          })}
          <Marker position={[first.lat, first.lng]} icon={flagIcon("A", "#166534")}>
            <Popup>Inicio del recorrido</Popup>
          </Marker>
          <Marker position={[last.lat, last.lng]} icon={flagIcon("B", "#7c2d12")}>
            <Popup>Meta del recorrido</Popup>
          </Marker>
          {<FitBounds key={boundsKey} positions={positions} />}
        </MapContainer>
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 px-4 py-3 text-xs font-bold">
        <LegendDot color={STATUS_COLOR.COMPLETED} label="Completada" />
        <LegendDot color={STATUS_COLOR.SKIPPED} label="Saltada" />
        <LegendDot color={STATUS_COLOR.NEXT} label="Próxima" />
        <LegendDot color={STATUS_COLOR.PENDING} label="Pendiente" />
        <LegendDot color="#166534" label="Inicio (A)" square />
        <LegendDot color="#7c2d12" label="Meta (B)" square />
      </div>
    </div>
  );
}

function LegendDot({ color, label, square = false }: { color: string; label: string; square?: boolean }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-forest-700">
      <span
        className={`inline-block h-3 w-3 border border-white shadow ${square ? "rounded" : "rounded-full"}`}
        style={{ background: color }}
      />
      {label}
    </span>
  );
}
