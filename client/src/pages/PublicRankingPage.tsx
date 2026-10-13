import { useCallback, useState } from "react";
import { useParams } from "react-router-dom";
import { ShieldAlert, Trophy } from "lucide-react";
import { api } from "@/api/client";
import { errorMessage, type PublicRanking, type TeamScoreDetail } from "@/api/types";
import { useApi } from "@/hooks/useApi";
import { LoadingScreen } from "@/components/LoadingScreen";
import { Alert } from "@/components/Alert";
import { Badge, ProgressBar } from "@/components/ProgressBar";
import { Modal } from "@/components/Modal";

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
            Actividades evaluadas: {detail.evaluatedCount}/{detail.activitiesCount}
          </Badge>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-beige-200 text-left text-xs font-bold uppercase tracking-wide text-forest-500">
              <th className="py-2 pr-3">Actividad</th>
              <th className="py-2 pr-3 text-center">Puntaje</th>
              <th className="py-2 pr-3 text-center">Máx.</th>
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
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Modal>
  );
}

export function PublicRankingPage() {
  const { eventId } = useParams();

  const fetchRanking = useCallback(
    () => api.get<PublicRanking>(eventId ? `/api/v1/ranking/${eventId}` : "/api/v1/ranking"),
    [eventId]
  );
  const { data: ranking, loading, error } = useApi<PublicRanking>(fetchRanking, [eventId]);

  const [detail, setDetail] = useState<TeamScoreDetail | null>(null);
  const [openError, setOpenError] = useState<string | null>(null);

  const openDetail = async (teamId: string) => {
    setOpenError(null);
    try {
      const detailResponse = await api.get<TeamScoreDetail>(
        `/api/v1/ranking/${ranking!.event.id}/teams/${teamId}`
      );
      setDetail(detailResponse);
    } catch (err) {
      setOpenError(errorMessage(err));
    }
  };

  if (loading && !ranking) return <LoadingScreen label="Cargando ranking…" />;
  if (error && !ranking) return <Alert tone="error">{error}</Alert>;
  if (!ranking) return null;

  if (!ranking.published) {
    return (
      <div className="space-y-4">
        <h2 className="font-display text-xl font-bold text-forest-900">Ranking general</h2>
        <Alert tone="info">
          <ShieldAlert className="mb-1 h-6 w-6 text-clay-600" />
          <p className="font-bold">Clasificación no disponible</p>
          <p className="font-semibold">
            El ranking se publicará cuando finalicen las evaluaciones. ¡Seguí participando!
          </p>
        </Alert>
      </div>
    );
  }

  const { teams } = ranking;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Trophy className="h-8 w-8 text-clay-600" />
        <div>
          <h2 className="font-display text-xl font-bold text-forest-900">Ranking general</h2>
          <p className="text-sm font-semibold text-forest-600">
            Los empates comparten posición. Tocá un equipo para ver sus puntajes.
          </p>
        </div>
      </div>

      {openError && <Alert tone="error">{openError}</Alert>}

      {!ranking.allComplete && ranking.activitiesCount > 0 && (
        <Alert tone="warning">
          Clasificación <strong>provisional</strong>: quedan evaluaciones en curso.
        </Alert>
      )}

      <section className="card overflow-x-auto">
        <table className="w-full min-w-[520px] text-sm">
          <thead>
            <tr className="border-b border-beige-200 text-left text-xs font-bold uppercase tracking-wide text-forest-500">
              <th className="py-2 pr-3">Pos.</th>
              <th className="py-2 pr-3">Equipo</th>
              <th className="py-2 pr-3">Puntaje total</th>
              <th className="py-2 pr-3">Progreso</th>
              <th className="py-2" />
            </tr>
          </thead>
          <tbody>
            {teams.map((t) => (
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
                <td className="py-2.5 pr-3">
                  <div className="w-32">
                    <ProgressBar value={t.evaluatedCount} max={t.activitiesCount} />
                  </div>
                </td>
                <td className="py-2.5 text-right">
                  <button
                    onClick={() => void openDetail(t.teamId)}
                    className="rounded-lg px-2.5 py-1.5 text-xs font-bold text-forest-600 hover:bg-forest-100"
                  >
                    Detalle
                  </button>
                </td>
              </tr>
            ))}
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