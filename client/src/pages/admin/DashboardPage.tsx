import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Play, CheckCircle2, XCircle, RefreshCw, Download } from "lucide-react";
import { api } from "@/api/client";
import type { Dashboard } from "@/api/types";
import { useApi } from "@/hooks/useApi";
import { LoadingScreen } from "@/components/LoadingScreen";
import { Alert } from "@/components/Alert";
import { Badge, ProgressBar } from "@/components/ProgressBar";
import { ConfirmDialog } from "@/components/Modal";

const STATUS_BADGE: Record<string, { label: string; tone: "green" | "orange" | "gray" | "red" }> = {
  FINALIZADO: { label: "Finalizado", tone: "green" },
  EN_RECORRIDO: { label: "En recorrido", tone: "orange" },
  NO_INICIADO: { label: "Sin iniciar", tone: "gray" },
  INACTIVO: { label: "Inactivo", tone: "red" },
};

export function DashboardPage() {
  const { eventId = "" } = useParams();
  const navigate = useNavigate();
  const fetchDashboard = useCallback(() => api.get<Dashboard>(`/api/v1/admin/dashboard?eventId=${eventId}`), [eventId]);
  const { data, loading, error, reload } = useApi<Dashboard>(fetchDashboard, [eventId]);
  const [confirmStart, setConfirmStart] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const id = setInterval(() => void reload(), 15000);
    return () => clearInterval(id);
  }, [reload]);

  const startEvent = async () => {
    setBusy(true);
    try {
      await api.post(`/api/v1/events/${eventId}/start`);
      setConfirmStart(false);
      await reload();
    } catch (err) {
      void err;
    } finally {
      setBusy(false);
    }
  };

  if (loading && !data) return <LoadingScreen label="Cargando pizarra…" />;
  if (error && !data) return <Alert tone="error">{error}</Alert>;
  if (!data) return null;

  const { counts } = data;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-bold text-forest-900">Pizarra del evento</h2>
          <p className="text-sm font-semibold text-forest-600">
            Se actualiza automáticamente cada 15 segundos.
          </p>
        </div>
        <div className="flex gap-2">
          {data.event.status === "PREPARED" && (
            <button onClick={() => setConfirmStart(true)} className="btn-primary">
              <Play className="h-5 w-5" /> Iniciar evento
            </button>
          )}
          {data.event.status === "IN_PROGRESS" && (
            <button
              onClick={() => void api.post(`/api/v1/events/${eventId}/finish`).then(reload)}
              className="btn-orange"
            >
              <CheckCircle2 className="h-5 w-5" /> Finalizar
            </button>
          )}
          {(data.event.status === "PREPARED" || data.event.status === "IN_PROGRESS") && (
            <button
              onClick={() => void api.post(`/api/v1/events/${eventId}/cancel`).then(reload)}
              className="btn-secondary"
            >
              <XCircle className="h-5 w-5" /> Cancelar
            </button>
          )}
          <button onClick={() => void reload()} className="btn-secondary">
            <RefreshCw className="h-5 w-5" /> Refrescar
          </button>
        </div>
      </div>

      {data.event.status === "IN_PROGRESS" && (
        <Alert tone="info">El evento está en curso. Los equipos pueden registrar visitas.</Alert>
      )}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Equipos" value={counts.teams} />
        <StatCard label="Sin iniciar" value={counts.teamsNotStarted} />
        <StatCard label="En recorrido" value={counts.teamsInProgress} />
        <StatCard label="Finalizados" value={counts.teamsFinished} />
      </div>

      <section className="card overflow-x-auto">
        <h3 className="mb-3 font-display text-lg font-bold text-forest-900">Equipos</h3>
        <table className="w-full min-w-[720px] text-sm">
          <thead>
            <tr className="border-b border-beige-200 text-left text-xs font-bold uppercase tracking-wide text-forest-500">
              <th className="py-2 pr-3">Equipo</th>
              <th className="py-2 pr-3">Progreso</th>
              <th className="py-2 pr-3">Próxima posta</th>
              <th className="py-2 pr-3">Inicio</th>
              <th className="py-2 pr-3">Fin</th>
              <th className="py-2 pr-3">Correctas</th>
              <th className="py-2 pr-3">Saltadas</th>
              <th className="py-2 pr-3">Estado</th>
            </tr>
          </thead>
          <tbody>
            {data.teams.map((t) => {
              const b = STATUS_BADGE[t.status] ?? { label: t.status, tone: "gray" as const };
              return (
                <tr key={t.teamId} className="border-b border-beige-100 last:border-0 hover:bg-forest-50/50">
                  <td className="py-2.5 pr-3">
                    <button onClick={() => navigate(`/admin/eventos/${eventId}/equipos`)} className="font-bold text-forest-900 underline-offset-2 hover:underline">
                      {t.team}
                    </button>
                  </td>
                  <td className="w-40 py-2.5 pr-3">
                    <div className="flex items-center gap-2">
                      <ProgressBar value={t.completed} max={t.totalStops} className="h-2.5 w-20" />
                      <span className="font-bold text-forest-700">{t.completed}/{t.totalStops}</span>
                    </div>
                  </td>
                  <td className="py-2.5 pr-3 font-semibold text-forest-700">{t.nextStation ?? "—"}</td>
                  <td className="py-2.5 pr-3 text-xs text-forest-600">{t.startAt ? new Date(t.startAt).toLocaleTimeString("es") : "—"}</td>
                  <td className="py-2.5 pr-3 text-xs text-forest-600">{t.finishAt ? new Date(t.finishAt).toLocaleTimeString("es") : "—"}</td>
                  <td className="py-2.5 pr-3">
                    <span className="font-bold text-forest-700">{t.correctAnswers}</span>
                    <span className="text-forest-400"> / {t.wrongAnswers}</span>
                  </td>
                  <td className="py-2.5 pr-3">
                    {t.skipped > 0 ? (
                      <span className="font-bold text-amber-700">{t.skipped}</span>
                    ) : (
                      <span className="text-forest-300">—</span>
                    )}
                  </td>
                  <td className="py-2.5"><Badge tone={b.tone}>{b.label}</Badge></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>

      <section className="card">
        <h3 className="mb-3 font-display text-lg font-bold text-forest-900">Últimas visitas</h3>
        {data.lastVisits.length === 0 ? (
          <p className="text-sm font-semibold text-forest-500">Todavía no hay visitas registradas.</p>
        ) : (
          <ul className="divide-y divide-beige-200">
            {data.lastVisits.map((v) => (
              <li key={v.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                <p className="min-w-0 truncate font-bold text-forest-900">
                  {v.team} → <span className="font-semibold text-forest-600">{v.station}</span>
                </p>
                <span className="shrink-0 text-xs font-semibold text-forest-500">
                  {new Date(v.visitedAt).toLocaleTimeString("es")} ·{" "}
                  {v.status === "VALID" ? (
                    <Badge tone="green">OK</Badge>
                  ) : v.status === "SKIPPED" ? (
                    <Badge tone="orange">Saltada</Badge>
                  ) : (
                    <Badge tone="red">Fallida</Badge>
                  )}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-display text-lg font-bold text-forest-900">Resultados y auditoría</h3>
          <p className="text-sm font-semibold text-forest-500">Exportá los resultados del evento a CSV.</p>
        </div>
        <a href={`/api/v1/admin/results?eventId=${eventId}`} className="btn-primary">
          <Download className="h-5 w-5" /> Exportar CSV
        </a>
      </section>

      {confirmStart && (
        <ConfirmDialog
          title="Iniciar evento"
          message={`Se pondrá en marcha "${data.event.name}". Los equipos podrán escanear sus postas. ¿Continuar?`}
          confirmLabel="Iniciar evento"
          busy={busy}
          onConfirm={() => void startEvent()}
          onClose={() => setConfirmStart(false)}
        />
      )}
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="card flex flex-col items-center py-4 text-center">
      <p className="font-display text-3xl font-bold text-forest-900">{value}</p>
      <p className="text-xs font-bold uppercase tracking-wide text-forest-500">{label}</p>
    </div>
  );
}