import { useCallback, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Download, Eye, EyeOff, ListChecks, Trophy } from "lucide-react";
import { api } from "@/api/client";
import {
  errorMessage,
  type Ranking,
  type RankingTeamRow,
  type TeamScoreDetail,
} from "@/api/types";
import { useApi } from "@/hooks/useApi";
import { LoadingScreen } from "@/components/LoadingScreen";
import { Alert } from "@/components/Alert";
import { Badge, ProgressBar } from "@/components/ProgressBar";
import { Modal } from "@/components/Modal";

const TEAM_STATUS: Record<
  RankingTeamRow["status"],
  { label: string; tone: "green" | "orange" | "gray" | "red" }
> = {
  COMPLETO: { label: "Completo", tone: "green" },
  EN_EVALUACION: { label: "En evaluación", tone: "orange" },
  PENDIENTE: { label: "Pendiente", tone: "gray" },
  INACTIVO: { label: "Inactivo", tone: "red" },
};

function TeamDetailModal({
  detail,
  onClose,
}: {
  detail: TeamScoreDetail;
  onClose: () => void;
}) {
  return (
    <Modal title={detail.team.name} onClose={onClose}>
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="green">Total: {detail.total}</Badge>
          <Badge tone="beige">
            Evaluadas: {detail.evaluatedCount}/{detail.activitiesCount}
          </Badge>
          {detail.pendingCount > 0 && (
            <Badge tone="orange">Pendientes: {detail.pendingCount}</Badge>
          )}
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-beige-200 text-left text-xs font-bold uppercase tracking-wide text-forest-500">
              <th className="py-2 pr-3">Actividad</th>
              <th className="py-2 pr-3 text-center">Puntaje</th>
              <th className="py-2 pr-3 text-center">Máx.</th>
              <th className="py-2">Estado</th>
            </tr>
          </thead>
          <tbody>
            {detail.activities.map((a) => (
              <tr key={a.activityId} className="border-b border-beige-100 last:border-0">
                <td className="py-2 pr-3 font-bold text-forest-900">
                  <span className="mr-1.5 text-forest-400">{a.position}</span>
                  {a.name}
                </td>
                <td className="py-2 pr-3 text-center font-extrabold text-forest-700">
                  {a.scored ? a.score : "—"}
                </td>
                <td className="py-2 pr-3 text-center font-semibold text-forest-400">
                  {a.maxScore === null ? "—" : a.maxScore}
                </td>
                <td className="py-2">
                  {a.scored ? <Badge tone="green">Evaluado</Badge> : <Badge tone="gray">Pendiente</Badge>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {detail.activities.some((a) => a.observations) && (
          <div className="rounded-2xl bg-beige-50 p-3">
            <h4 className="mb-1 text-xs font-bold uppercase tracking-wide text-forest-500">
              Observaciones privadas
            </h4>
            <ul className="space-y-1 text-sm">
              {detail.activities
                .filter((a) => a.observations)
                .map((a) => (
                  <li key={a.activityId}>
                    <span className="font-bold text-forest-800">{a.name}:</span>{" "}
                    <span className="font-semibold text-forest-600">{a.observations}</span>
                  </li>
                ))}
            </ul>
          </div>
        )}
      </div>
    </Modal>
  );
}

export function AdminRankingPage() {
  const { eventId = "" } = useParams();

  const fetchRanking = useCallback(
    () => api.get<Ranking>(`/api/v1/admin/scoring/ranking?eventId=${eventId}`),
    [eventId]
  );
  const { data: ranking, loading, error, reload } = useApi<Ranking>(fetchRanking, [eventId]);

  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [detail, setDetail] = useState<TeamScoreDetail | null>(null);

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setActionError(null);
    try {
      await fn();
      await reload();
    } catch (err) {
      setActionError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const togglePublish = () => {
    if (!ranking) return;
    void run(() =>
      api.post("/api/v1/admin/scoring/ranking/publish", {
        eventId,
        published: !ranking.event.rankingPublished,
      })
    );
  };

  const openDetail = async (teamId: string) => {
    setBusy(true);
    setActionError(null);
    try {
      const detailResponse = await api.get<TeamScoreDetail>(
        `/api/v1/admin/scoring/teams/${teamId}?eventId=${eventId}`
      );
      setDetail(detailResponse);
    } catch (err) {
      setActionError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  if (loading && !ranking) return <LoadingScreen label="Cargando ranking…" />;
  if (error && !ranking) return <Alert tone="error">{error}</Alert>;
  if (!ranking) return null;

  const { teams } = ranking;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-bold text-forest-900">Ranking general</h2>
          <p className="text-sm font-semibold text-forest-600">
            Posiciones por puntaje total. Los empates comparten posición.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            to={`/ranking/${eventId}`}
            className="btn-secondary"
            title="Vista pública del ranking"
          >
            <Eye className="h-5 w-5" /> Ver público
          </Link>
          <a href={`/api/v1/admin/scoring/export?eventId=${eventId}`} className="btn-secondary">
            <Download className="h-5 w-5" /> CSV
          </a>
          <Link to={`/admin/eventos/${eventId}/actividades`} className="btn-secondary">
            <ListChecks className="h-5 w-5" /> Actividades
          </Link>
          <button
            onClick={togglePublish}
            disabled={busy}
            className={ranking.event.rankingPublished ? "btn-secondary" : "btn-primary"}
          >
            {ranking.event.rankingPublished ? (
              <>
                <EyeOff className="h-5 w-5" /> Ocultar ranking
              </>
            ) : (
              <>
                <Eye className="h-5 w-5" /> Publicar ranking
              </>
            )}
          </button>
        </div>
      </div>

      {actionError && <Alert tone="error">{actionError}</Alert>}

      {ranking.event.rankingPublished ? (
        <Alert tone="success">
          El ranking está <strong>publicado</strong>.{" "}
          {ranking.event.rankingPublishedAt &&
            `Publicado el ${new Date(ranking.event.rankingPublishedAt).toLocaleString("es")}.`}{" "}
          Cualquier cambio de puntajes se refleja de inmediato.
        </Alert>
      ) : (
        <Alert tone="warning">
          El ranking está <strong>oculto</strong>: los equipos y el público ven
          "clasificación no disponible" hasta que se publique.
        </Alert>
      )}

      {!ranking.allComplete && ranking.activitiesCount > 0 && (
        <Alert tone="warning">
          <Trophy className="mb-1 h-5 w-5 text-clay-600" />
          Todavía hay <strong>evaluaciones pendientes</strong>. El ranking actual es{" "}
          <strong>provisional</strong>: las actividades sin evaluar no cuentan como cero.
        </Alert>
      )}

      <section className="card overflow-x-auto">
        <table className="w-full min-w-[620px] text-sm">
          <thead>
            <tr className="border-b border-beige-200 text-left text-xs font-bold uppercase tracking-wide text-forest-500">
              <th className="py-2 pr-3">Pos.</th>
              <th className="py-2 pr-3">Equipo</th>
              <th className="py-2 pr-3">Puntaje total</th>
              <th className="py-2 pr-3">Evaluadas</th>
              <th className="py-2 pr-3">Progreso</th>
              <th className="py-2 pr-3">Estado</th>
              <th className="py-2" />
            </tr>
          </thead>
          <tbody>
            {teams.map((t) => {
              const badge = TEAM_STATUS[t.status];
              return (
                <tr key={t.teamId} className="border-b border-beige-100 last:border-0">
                  <td className="py-2.5 pr-3">
                    <span
                      className={`inline-flex h-8 w-8 items-center justify-center rounded-full text-sm font-extrabold ${
                        t.position === 1
                          ? "bg-clay-500 text-white"
                          : "bg-beige-200 text-forest-800"
                      }`}
                    >
                      {t.position}
                    </span>
                  </td>
                  <td className="py-2.5 pr-3 font-bold text-forest-900">{t.team}</td>
                  <td className="py-2.5 pr-3 font-extrabold text-forest-700">{t.total}</td>
                  <td className="py-2.5 pr-3 font-semibold text-forest-600">
                    {t.evaluatedCount}/{t.activitiesCount}
                  </td>
                  <td className="py-2.5 pr-3">
                    <div className="w-32">
                      <ProgressBar value={t.evaluatedCount} max={t.activitiesCount} />
                    </div>
                  </td>
                  <td className="py-2.5 pr-3">
                    <Badge tone={badge.tone}>{badge.label}</Badge>
                  </td>
                  <td className="py-2.5 text-right">
                    <button
                      onClick={() => void openDetail(t.teamId)}
                      disabled={busy}
                      className="rounded-lg px-2.5 py-1.5 text-xs font-bold text-forest-600 hover:bg-forest-100"
                    >
                      Detalle
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {teams.length === 0 && (
          <p className="py-6 text-center text-sm font-semibold text-forest-500">
            Sin equipos para mostrar.
          </p>
        )}
      </section>

      {detail && <TeamDetailModal detail={detail} onClose={() => setDetail(null)} />}
    </div>
  );
}