import { useCallback } from "react";
import { useParams } from "react-router-dom";
import { Download, FileClock } from "lucide-react";
import { api } from "@/api/client";
import type { AuditLogEntry, Dashboard } from "@/api/types";
import { useApi } from "@/hooks/useApi";
import { LoadingScreen } from "@/components/LoadingScreen";
import { Alert } from "@/components/Alert";
import { Badge } from "@/components/ProgressBar";

export function ResultsPage() {
  const { eventId = "" } = useParams();
  const fetchDashboard = useCallback(() => api.get<Dashboard>(`/api/v1/admin/dashboard?eventId=${eventId}`), [eventId]);
  const { data: dashboard, loading, error } = useApi<Dashboard>(fetchDashboard, [eventId]);
  const fetchLogs = useCallback(() => api.get<{ logs: AuditLogEntry[] }>(`/api/v1/admin/audit-logs?eventId=${eventId}`).then((r) => r.logs), [eventId]);
  const { data: logs, loading: logsLoading, error: logsError } = useApi<AuditLogEntry[]>(fetchLogs, [eventId]);

  if ((loading && !dashboard) || (logsLoading && !logs)) return <LoadingScreen label="Cargando resultados…" />;

  const sorted = (dashboard?.teams ?? []).slice().sort((a, b) => {
    if (a.done !== b.done) return a.done ? -1 : 1;
    if (a.completed !== b.completed) return b.completed - a.completed;
    return 0;
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-bold text-forest-900">Resultados</h2>
          <p className="text-sm font-semibold text-forest-600">
            Resumen y exportación de los resultados del evento.
          </p>
        </div>
        <a href={`/api/v1/admin/results?eventId=${eventId}`} className="btn-primary">
          <Download className="h-5 w-5" /> Exportar CSV
        </a>
      </div>

      {error && !dashboard && <Alert tone="error">{error}</Alert>}

      <section className="card overflow-x-auto">
        <table className="w-full min-w-[560px] text-sm">
          <thead>
            <tr className="border-b border-beige-200 text-left text-xs font-bold uppercase tracking-wide text-forest-500">
              <th className="py-2 pr-3">#</th>
              <th className="py-2 pr-3">Equipo</th>
              <th className="py-2 pr-3">Progreso</th>
              <th className="py-2 pr-3">Correctas</th>
              <th className="py-2 pr-3">Incorrectas</th>
              <th className="py-2 pr-3">Inicio</th>
              <th className="py-2 pr-3">Fin</th>
              <th className="py-2 pr-3">Estado</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((t, i) => (
              <tr key={t.teamId} className="border-b border-beige-100 last:border-0">
                <td className="py-2.5 pr-3 font-bold text-forest-500">{i + 1}</td>
                <td className="py-2.5 pr-3 font-bold text-forest-900">{t.team}</td>
                <td className="py-2.5 pr-3 font-semibold text-forest-700">{t.completed}/{t.totalStops}</td>
                <td className="py-2.5 pr-3 font-bold text-forest-700">{t.correctAnswers}</td>
                <td className="py-2.5 pr-3 text-forest-600">{t.wrongAnswers}</td>
                <td className="py-2.5 pr-3 text-xs text-forest-600">
                  {t.startAt ? new Date(t.startAt).toLocaleTimeString("es") : "—"}
                </td>
                <td className="py-2.5 pr-3 text-xs text-forest-600">
                  {t.finishAt ? new Date(t.finishAt).toLocaleTimeString("es") : "—"}
                </td>
                <td className="py-2.5">
                  {t.done ? <Badge tone="green">Finalizado</Badge> : t.completed > 0 ? <Badge tone="orange">En recorrido</Badge> : <Badge tone="gray">Sin iniciar</Badge>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {logsError && <Alert tone="error">{logsError}</Alert>}
      <section className="card">
        <h3 className="mb-3 flex items-center gap-2 font-display text-lg font-bold text-forest-900">
          <FileClock className="h-5 w-5 text-clay-600" /> Auditoría
        </h3>
        {!logs || logs.length === 0 ? (
          <p className="text-sm font-semibold text-forest-500">Sin registros de auditoría todavía.</p>
        ) : (
          <ul className="divide-y divide-beige-100">
            {logs.map((l) => (
              <li key={l.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2 text-sm">
                <Badge tone="beige">{l.action}</Badge>
                <span className="font-semibold text-forest-700">
                  {l.entity} {l.team?.name ?? l.user?.username ?? ""}
                </span>
                <span className="text-xs font-semibold text-forest-500">
                  {new Date(l.createdAt).toLocaleString("es")}
                </span>
                {l.details && <span className="font-mono text-xs text-forest-400">{JSON.stringify(l.details)}</span>}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}