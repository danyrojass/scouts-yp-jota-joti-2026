import { useCallback, useEffect } from "react";
import { Link } from "react-router-dom";
import { Camera, Route, CheckCircle2, Circle, MapPin, Clock } from "lucide-react";
import { api } from "@/api/client";
import type { Passport } from "@/api/types";
import { useApi } from "@/hooks/useApi";
import { LoadingScreen } from "@/components/LoadingScreen";
import { Alert } from "@/components/Alert";
import { ProgressBar, Badge } from "@/components/ProgressBar";

const EVENT_STATUS: Record<string, { label: string; tone: "orange" | "green" | "red" | "gray" }> = {
  PREPARED: { label: "Preparado", tone: "orange" },
  IN_PROGRESS: { label: "En curso", tone: "green" },
  FINISHED: { label: "Finalizado", tone: "gray" },
  CANCELLED: { label: "Cancelado", tone: "red" },
};

const TYPE_LABEL: Record<string, string> = {
  CODE: "Código / palabra",
  QUESTION: "Pregunta",
  CONFIRMATION: "Confirmación",
  AUTO: "Evaluación automática",
};

export function PassportPage() {
  const fetchPassport = useCallback(() => api.get<Passport>("/api/v1/passport"), []);
  const { data, loading, error, reload } = useApi<Passport>(fetchPassport);

  useEffect(() => {
    const id = setInterval(() => void reload(), 15000);
    return () => clearInterval(id);
  }, [reload]);

  if (loading && !data) return <LoadingScreen label="Cargando pasaporte..." />;
  if (error && !data) return <Alert tone="error">{error}</Alert>;
  if (!data) return null;

  const { team, event, progress, stops, history } = data;
  const eventBadge = EVENT_STATUS[event.status] ?? { label: event.status, tone: "gray" as const };
  const nextStop = stops.find((s) => !s.completed) ?? null;

  return (
    <div className="space-y-4">
      <section className="card">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-clay-600">Pasaporte del equipo</p>
            <h1 className="font-display text-2xl font-bold text-forest-900">{team.name}</h1>
            <p className="flex items-center gap-1 text-sm font-semibold text-forest-600">
              <MapPin className="h-4 w-4" /> {event.name}
            </p>
          </div>
          <Badge tone={eventBadge.tone}>{eventBadge.label}</Badge>
        </div>

        <div className="mt-4">
          <div className="mb-1.5 flex items-baseline justify-between">
            <p className="text-sm font-bold text-forest-800">
              {progress.completed} de {progress.total} postas completadas
            </p>
            <p className="text-sm font-extrabold text-clay-600">
              {progress.total > 0 ? Math.round((progress.completed / progress.total) * 100) : 0}%
            </p>
          </div>
          <ProgressBar value={progress.completed} max={progress.total} />
        </div>

        {progress.done && (
          <div className="mt-4">
            <Alert tone="success">¡Recorrido completado! Felicitaciones al equipo {team.name}.</Alert>
          </div>
        )}
        {!progress.done && nextStop && event.status === "IN_PROGRESS" && (
          <div className="mt-4 flex items-center gap-2 rounded-2xl bg-clay-50 px-4 py-3">
            <Route className="h-5 w-5 shrink-0 text-clay-600" />
            <p className="text-sm font-bold text-clay-700">
              Próxima posta (paso {nextStop.position}): <span className="underline">{nextStop.name}</span>
            </p>
          </div>
        )}

        <div className="mt-5 grid grid-cols-2 gap-3">
          <Link to="/escanear" className="btn-orange w-full">
            <Camera className="h-5 w-5" /> Escanear
          </Link>
          <Link to="/itinerario" className="btn-secondary w-full">
            <Route className="h-5 w-5" /> Mi ruta
          </Link>
        </div>
        <button onClick={() => void reload()} className="mt-3 w-full text-center text-xs font-bold text-forest-500 hover:text-forest-700">
          Actualizar progreso
        </button>
      </section>

      <section className="card">
        <h2 className="mb-3 font-display text-lg font-bold text-forest-900">Postas del recorrido</h2>
        <ol className="space-y-2">
          {stops.map((stop) => (
            <li
              key={stop.stationId}
              className={`flex items-start gap-3 rounded-2xl border px-3.5 py-3 ${
                stop.completed
                  ? "border-forest-200 bg-forest-50"
                  : stop.stationId === progress.nextStationId
                    ? "border-clay-400 bg-clay-50 shadow-card"
                    : "border-beige-200 bg-white"
              }`}
            >
              <span
                className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-extrabold ${
                  stop.completed ? "bg-forest-600 text-white" : "bg-beige-200 text-forest-800"
                }`}
              >
                {stop.position}
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-bold text-forest-900">{stop.name}</p>
                <p className="text-xs font-semibold text-forest-500">{TYPE_LABEL[stop.challengeType]}</p>
              </div>
              {stop.completed ? (
                <CheckCircle2 className="h-6 w-6 shrink-0 text-forest-600" />
              ) : (
                <Circle className="h-6 w-6 shrink-0 text-beige-300" />
              )}
            </li>
          ))}
        </ol>
      </section>

      <section className="card">
        <h2 className="mb-3 flex items-center gap-2 font-display text-lg font-bold text-forest-900">
          <Clock className="h-5 w-5 text-clay-600" /> Últimas visitas
        </h2>
        {history.length === 0 ? (
          <p className="text-sm font-semibold text-forest-500">
            Todavía no hay visitas registradas. Escaneá tu primera posta.
          </p>
        ) : (
          <ul className="divide-y divide-beige-200">
            {history.slice(0, 10).map((v) => (
              <li key={v.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                <div>
                  <p className="font-bold text-forest-900">{v.stationName ?? "Posta"}</p>
                  <p className="text-xs font-semibold text-forest-500">
                    {new Date(v.visitedAt).toLocaleString("es")}
                  </p>
                </div>
                {v.status === "VALID" ? (
                  <Badge tone="green">Completada</Badge>
                ) : (
                  <Badge tone="red">Fallida (intento {v.attemptNumber})</Badge>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <p className="text-center text-xs text-forest-500">
        El progreso se guarda en el servidor y se actualiza automáticamente.
      </p>
    </div>
  );
}