import { useCallback } from "react";
import { Link } from "react-router-dom";
import { Flag, ScanLine, Map, Navigation } from "lucide-react";
import { api } from "@/api/client";
import type { Passport } from "@/api/types";
import { useApi } from "@/hooks/useApi";
import { LoadingScreen } from "@/components/LoadingScreen";
import { Alert } from "@/components/Alert";
import { ItineraryMap, stopStatus } from "@/components/ItineraryMap";

export function ItineraryPage() {
  const fetchPassport = useCallback(() => api.get<Passport>("/api/v1/passport"), []);
  const { data, loading, error } = useApi<Passport>(fetchPassport);

  if (loading && !data) return <LoadingScreen label="Cargando itinerario..." />;
  if (error && !data) return <Alert tone="error">{error}</Alert>;
  if (!data) return null;

  const { stops, progress } = data;
  const nextPosition = progress.nextPosition;

  return (
    <div className="space-y-4">
      <section className="card">
        <div className="flex items-center gap-3">
          <Map className="h-8 w-8 text-clay-600" />
          <div>
            <h1 className="font-display text-2xl font-bold text-forest-900">Mi itinerario</h1>
            <p className="text-sm font-semibold text-forest-600">
              Seguí el recorrido en el mapa y marcá cada posta.
            </p>
          </div>
        </div>
      </section>

      <ItineraryMap stops={stops} nextPosition={nextPosition} done={progress.done} />

      <section className="card">
        <ol className="space-y-2">
          {stops.map((stop) => {
            const status = stopStatus(stop, nextPosition, progress.done);
            const hasCoords = stop.latitude != null && stop.longitude != null;
            return (
              <li
                key={stop.stationId}
                className={`flex items-center gap-3 rounded-2xl border px-3.5 py-3 ${
                  status === "COMPLETED"
                    ? "border-forest-200 bg-forest-50"
                    : status === "NEXT"
                      ? "border-clay-400 bg-clay-50 shadow-card"
                      : "border-beige-200 bg-white"
                }`}
              >
                <span
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full font-extrabold ${
                    status === "COMPLETED"
                      ? "bg-forest-600 text-white"
                      : status === "NEXT"
                        ? "bg-clay-500 text-white"
                        : "bg-beige-200 text-forest-800"
                  }`}
                >
                  {stop.position}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-bold text-forest-900">{stop.name}</p>
                  {status === "NEXT" && (
                    <p className="text-xs font-bold uppercase tracking-wide text-clay-600">Posta actual</p>
                  )}
                  {status === "COMPLETED" && (
                    <p className="text-xs font-bold uppercase tracking-wide text-forest-600">Completada</p>
                  )}
                  {!hasCoords && (
                    <p className="text-xs font-semibold text-forest-400">Sin ubicación en el mapa</p>
                  )}
                </div>
                {status === "NEXT" && <Flag className="h-6 w-6 shrink-0 text-clay-600" />}
                {stop.mapsUrl && (
                  <a
                    href={stop.mapsUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="flex shrink-0 items-center gap-1 rounded-xl bg-forest-50 px-2.5 py-1.5 text-xs font-bold text-forest-700 hover:bg-forest-100"
                    title="Cómo llegar"
                  >
                    <Navigation className="h-4 w-4" /> Ir
                  </a>
                )}
              </li>
            );
          })}
        </ol>

        {progress.done && (
          <div className="mt-4">
            <Alert tone="success">¡Completaste todas las postas del recorrido!</Alert>
          </div>
        )}
      </section>

      <Link to="/escanear" className="btn-orange w-full">
        <ScanLine className="h-5 w-5" /> Escanear próxima posta
      </Link>
    </div>
  );
}
