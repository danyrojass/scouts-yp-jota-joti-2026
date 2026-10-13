import { useCallback, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  Download,
  Plus,
  Pencil,
  Trash2,
  ArrowUp,
  ArrowDown,
  Trophy,
  Eye,
  EyeOff,
} from "lucide-react";
import { api } from "@/api/client";
import {
  errorMessage,
  type ActivityItem,
  type ActivityStatus,
  type ScoreMatrix,
  type ScoringMethod,
  type TeamActivityScoreItem,
} from "@/api/types";
import { useApi } from "@/hooks/useApi";
import { LoadingScreen } from "@/components/LoadingScreen";
import { Alert } from "@/components/Alert";
import { Badge } from "@/components/ProgressBar";
import { Modal, ConfirmDialog } from "@/components/Modal";

const STATUS_OPTIONS: { value: ActivityStatus; label: string }[] = [
  { value: "PENDING", label: "Pendiente" },
  { value: "IN_EVALUATION", label: "En evaluación" },
  { value: "FINISHED", label: "Finalizada" },
];

const METHOD_OPTIONS: { value: ScoringMethod; label: string }[] = [
  { value: "MANUAL", label: "Manual" },
  { value: "CHECKLIST", label: "Checklist (Safari)" },
  { value: "STATIONS", label: "Postas QR" },
];

const statusLabel = (s: ActivityStatus) =>
  STATUS_OPTIONS.find((o) => o.value === s)?.label ?? s;
const methodLabel = (m: ScoringMethod) =>
  METHOD_OPTIONS.find((o) => o.value === m)?.label ?? m;

const statusTone = (s: ActivityStatus) =>
  s === "FINISHED" ? "green" : s === "IN_EVALUATION" ? "orange" : "gray";

type ActivityFormValues = {
  name: string;
  description: string;
  maxScore: string;
  status: ActivityStatus;
  scoringMethod: ScoringMethod;
  published: boolean;
  allowMaxScoreExceeded: boolean;
  active: boolean;
};

const EMPTY_ACTIVITY: ActivityFormValues = {
  name: "",
  description: "",
  maxScore: "",
  status: "PENDING",
  scoringMethod: "MANUAL",
  published: false,
  allowMaxScoreExceeded: false,
  active: true,
};

function activityToForm(a: ActivityItem): ActivityFormValues {
  return {
    name: a.name,
    description: a.description ?? "",
    maxScore: a.maxScore === null ? "" : String(a.maxScore),
    status: a.status,
    scoringMethod: a.scoringMethod,
    published: a.published,
    allowMaxScoreExceeded: a.allowMaxScoreExceeded,
    active: a.active,
  };
}

function ActivityFormModal({
  title,
  initial,
  busy,
  onSave,
  onClose,
}: {
  title: string;
  initial: ActivityFormValues;
  busy: boolean;
  onSave: (values: ActivityFormValues) => void;
  onClose: () => void;
}) {
  const [values, setValues] = useState<ActivityFormValues>(initial);
  return (
    <Modal title={title} onClose={onClose}>
      <div className="space-y-4">
        <div>
          <label className="label">Nombre</label>
          <input
            className="input"
            value={values.name}
            onChange={(e) => setValues({ ...values, name: e.target.value })}
            placeholder="Guardianes del planeta"
          />
        </div>
        <div>
          <label className="label">Descripción (opcional)</label>
          <textarea
            className="input"
            rows={2}
            value={values.description}
            onChange={(e) => setValues({ ...values, description: e.target.value })}
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label">Estado</label>
            <select
              className="input"
              value={values.status}
              onChange={(e) =>
                setValues({ ...values, status: e.target.value as ActivityStatus })
              }
            >
              {STATUS_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Método de puntuación</label>
            <select
              className="input"
              value={values.scoringMethod}
              onChange={(e) =>
                setValues({ ...values, scoringMethod: e.target.value as ScoringMethod })
              }
            >
              {METHOD_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div>
          <label className="label">Puntaje máximo (opcional)</label>
          <input
            className="input"
            type="number"
            min={0}
            step="any"
            value={values.maxScore}
            onChange={(e) => setValues({ ...values, maxScore: e.target.value })}
            placeholder="Sin tope"
          />
        </div>
        <label className="flex items-center gap-2 font-bold text-forest-800">
          <input
            type="checkbox"
            checked={values.allowMaxScoreExceeded}
            onChange={(e) =>
              setValues({ ...values, allowMaxScoreExceeded: e.target.checked })
            }
            className="h-4 w-4 accent-forest-700"
          />
          Permitir puntajes mayores al máximo
        </label>
        <label className="flex items-center gap-2 font-bold text-forest-800">
          <input
            type="checkbox"
            checked={values.published}
            onChange={(e) => setValues({ ...values, published: e.target.checked })}
            className="h-4 w-4 accent-forest-700"
          />
          Resultados publicados (visibles en el ranking público)
        </label>
        <label className="flex items-center gap-2 font-bold text-forest-800">
          <input
            type="checkbox"
            checked={values.active}
            onChange={(e) => setValues({ ...values, active: e.target.checked })}
            className="h-4 w-4 accent-forest-700"
          />
          Actividad activa
        </label>
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="btn-secondary">
            Cancelar
          </button>
          <button
            onClick={() => onSave(values)}
            disabled={busy || values.name.trim().length < 2}
            className="btn-primary"
          >
            Guardar
          </button>
        </div>
      </div>
    </Modal>
  );
}

function ScoreModal({
  team,
  activity,
  existing,
  busy,
  onSave,
  onDelete,
  onClose,
}: {
  team: { id: string; name: string };
  activity: ActivityItem;
  existing: TeamActivityScoreItem | null;
  busy: boolean;
  onSave: (values: { evaluated: boolean; score: string; observations: string }) => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  const [evaluated, setEvaluated] = useState(existing?.evaluated ?? true);
  const [score, setScore] = useState(
    existing?.evaluated && existing.score !== null ? String(existing.score) : ""
  );
  const [observations, setObservations] = useState(existing?.observations ?? "");
  const maxLabel = activity.maxScore === null ? "sin tope" : `máx. ${activity.maxScore}`;

  return (
    <Modal title={`${team.name} · ${activity.name}`} onClose={onClose}>
      <div className="space-y-4">
        <label className="flex items-center gap-2 font-bold text-forest-800">
          <input
            type="checkbox"
            checked={evaluated}
            onChange={(e) => setEvaluated(e.target.checked)}
            className="h-4 w-4 accent-forest-700"
          />
          Evaluado ({maxLabel})
        </label>
        <div>
          <label className="label">Puntaje obtenido {evaluated ? "" : "(sin evaluar)"}</label>
          <input
            className="input"
            type="number"
            min={0}
            step="any"
            disabled={!evaluated}
            value={score}
            onChange={(e) => setScore(e.target.value)}
            placeholder="0"
          />
          <p className="mt-1 text-xs font-semibold text-forest-500">
            Un puntaje de 0 es distinto de "sin evaluar". Dejar sin evaluar no cuenta
            como cero en el total.
          </p>
        </div>
        <div>
          <label className="label">Observaciones (privadas)</label>
          <textarea
            className="input"
            rows={2}
            value={observations}
            onChange={(e) => setObservations(e.target.value)}
          />
        </div>
        <div className="flex items-center justify-between gap-2">
          {existing ? (
            <button onClick={onDelete} disabled={busy} className="btn-danger px-3 py-2 text-sm">
              <Trash2 className="h-4 w-4" /> Borrar
            </button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <button onClick={onClose} className="btn-secondary">
              Cancelar
            </button>
            <button
              onClick={() => onSave({ evaluated, score, observations })}
              disabled={busy}
              className="btn-primary"
            >
              Guardar
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}

export function ScoringAdminPage() {
  const { eventId = "" } = useParams();

  const fetchMatrix = useCallback(
    () => api.get<ScoreMatrix>(`/api/v1/admin/scoring/scores?eventId=${eventId}`),
    [eventId]
  );
  const { data: matrix, loading, error, reload } = useApi<ScoreMatrix>(fetchMatrix, [eventId]);

  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [activityModal, setActivityModal] = useState<{ activity: ActivityItem | null } | null>(null);
  const [confirmDeleteActivity, setConfirmDeleteActivity] = useState<ActivityItem | null>(null);
  const [scoreModal, setScoreModal] = useState<{ team: { id: string; name: string }; activity: ActivityItem } | null>(null);

  const activities = useMemo(
    () => [...(matrix?.activities ?? [])].sort((a, b) => a.position - b.position),
    [matrix]
  );
  const teams = matrix?.teams ?? [];
  const scoreMap = useMemo(() => {
    const map = new Map<string, TeamActivityScoreItem>();
    for (const s of matrix?.scores ?? []) map.set(`${s.teamId}:${s.activityId}`, s);
    return map;
  }, [matrix]);

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setActionError(null);
    try {
      await fn();
      await reload();
    } catch (err) {
      setActionError(errorMessage(err));
      throw err;
    } finally {
      setBusy(false);
    }
  };

  const saveActivity = (values: ActivityFormValues) => {
    const editing = activityModal?.activity ?? null;
    const body = {
      name: values.name,
      description: values.description || null,
      maxScore: values.maxScore.trim() === "" ? null : Number(values.maxScore),
      status: values.status,
      scoringMethod: values.scoringMethod,
      published: values.published,
      allowMaxScoreExceeded: values.allowMaxScoreExceeded,
      active: values.active,
    };
    return run(() =>
      editing
        ? api.patch(`/api/v1/admin/scoring/activities/${editing.id}`, body)
        : api.post("/api/v1/admin/scoring/activities", { eventId, ...body })
    ).then(() => setActivityModal(null));
  };

  const deleteActivity = () => {
    if (!confirmDeleteActivity) return;
    void run(() =>
      api.del(`/api/v1/admin/scoring/activities/${confirmDeleteActivity.id}`)
    ).then(() => setConfirmDeleteActivity(null));
  };

  const move = (index: number, dir: -1 | 1) => {
    const target = index + dir;
    if (target < 0 || target >= activities.length) return;
    const ids = activities.map((a) => a.id);
    [ids[index], ids[target]] = [ids[target], ids[index]];
    void run(() =>
      api.patch("/api/v1/admin/scoring/activities/reorder", { eventId, activityIds: ids })
    );
  };

  const saveScore = (values: { evaluated: boolean; score: string; observations: string }) => {
    if (!scoreModal) return;
    const { team, activity } = scoreModal;
    const body = {
      eventId,
      teamId: team.id,
      activityId: activity.id,
      evaluated: values.evaluated,
      score: values.evaluated ? Number(values.score) : null,
      observations: values.observations || null,
    };
    return run(() => api.put("/api/v1/admin/scoring/scores", body)).then(() =>
      setScoreModal(null)
    );
  };

  const deleteScore = () => {
    if (!scoreModal) return;
    const existing = scoreMap.get(`${scoreModal.team.id}:${scoreModal.activity.id}`);
    if (!existing) {
      setScoreModal(null);
      return;
    }
    void run(() => api.del(`/api/v1/admin/scoring/scores/${existing.id}`)).then(() =>
      setScoreModal(null)
    );
  };

  const togglePublish = () => {
    if (!matrix) return;
    void run(() =>
      api.post("/api/v1/admin/scoring/ranking/publish", {
        eventId,
        published: !matrix.event.rankingPublished,
      })
    );
  };

  if (loading && !matrix) return <LoadingScreen label="Cargando actividades y puntuaciones…" />;
  if (error && !matrix) return <Alert tone="error">{error}</Alert>;
  if (!matrix) return null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-bold text-forest-900">
            Actividades y puntuaciones
          </h2>
          <p className="text-sm font-semibold text-forest-600">
            Configurá las actividades y cargá los puntos de cada equipo.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link to={`/admin/eventos/${eventId}/ranking`} className="btn-secondary">
            <Trophy className="h-5 w-5" /> Ranking
          </Link>
          <a href={`/api/v1/admin/scoring/export?eventId=${eventId}`} className="btn-secondary">
            <Download className="h-5 w-5" /> CSV
          </a>
          <button onClick={() => setActivityModal({ activity: null })} className="btn-primary">
            <Plus className="h-5 w-5" /> Nueva actividad
          </button>
        </div>
      </div>

      {actionError && <Alert tone="error">{actionError}</Alert>}

      <section className="card">
        <h3 className="mb-3 font-display text-lg font-bold text-forest-900">
          Actividades ({activities.length})
        </h3>
        {activities.length === 0 ? (
          <p className="text-sm font-semibold text-forest-500">
            Todavía no hay actividades. Creá la primera.
          </p>
        ) : (
          <ul className="space-y-2">
            {activities.map((activity, i) => (
              <li
                key={activity.id}
                className="flex items-center gap-2 rounded-2xl border border-beige-200 bg-beige-50 px-3 py-2"
              >
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-forest-700 text-xs font-extrabold text-white">
                  {i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-bold text-forest-900">{activity.name}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5">
                    <Badge tone={statusTone(activity.status)}>
                      {statusLabel(activity.status)}
                    </Badge>
                    <Badge tone="beige">{methodLabel(activity.scoringMethod)}</Badge>
                    <Badge tone="gray">
                      {activity.maxScore === null ? "Sin tope" : `Máx. ${activity.maxScore}`}
                    </Badge>
                    {activity.published ? (
                      <Badge tone="green">Publicada</Badge>
                    ) : (
                      <Badge tone="gray">Oculta</Badge>
                    )}
                    {activity.allowMaxScoreExceeded && <Badge tone="orange">Permite exceso</Badge>}
                    {!activity.active && <Badge tone="red">Inactiva</Badge>}
                  </div>
                </div>
                <button
                  onClick={() => move(i, -1)}
                  disabled={i === 0 || busy}
                  className="rounded-lg p-1.5 text-forest-600 hover:bg-forest-100 disabled:opacity-30"
                >
                  <ArrowUp className="h-4 w-4" />
                </button>
                <button
                  onClick={() => move(i, 1)}
                  disabled={i === activities.length - 1 || busy}
                  className="rounded-lg p-1.5 text-forest-600 hover:bg-forest-100 disabled:opacity-30"
                >
                  <ArrowDown className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setActivityModal({ activity })}
                  className="rounded-lg p-1.5 text-forest-600 hover:bg-forest-100"
                >
                  <Pencil className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setConfirmDeleteActivity(activity)}
                  className="rounded-lg p-1.5 text-red-500 hover:bg-red-50"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card overflow-x-auto">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-display text-lg font-bold text-forest-900">Carga de puntajes</h3>
          <button
            onClick={togglePublish}
            disabled={busy}
            className={matrix.event.rankingPublished ? "btn-secondary" : "btn-primary"}
          >
            {matrix.event.rankingPublished ? (
              <>
                <EyeOff className="h-4 w-4" /> Ocultar ranking público
              </>
            ) : (
              <>
                <Eye className="h-4 w-4" /> Publicar ranking
              </>
            )}
          </button>
        </div>

        {activities.length === 0 || teams.length === 0 ? (
          <p className="text-sm font-semibold text-forest-500">
            Necesitás al menos una actividad y un equipo para cargar puntajes.
          </p>
        ) : (
          <table className="w-full min-w-[640px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-beige-200 text-left text-xs font-bold uppercase tracking-wide text-forest-500">
                <th className="sticky left-0 bg-white py-2 pr-3">Equipo</th>
                {activities.map((a) => (
                  <th key={a.id} className="py-2 px-2 text-center">
                    <span className="block max-w-[140px] truncate" title={a.name}>
                      {a.name}
                    </span>
                    <span className="font-normal normal-case text-forest-400">
                      {a.maxScore === null ? "sin tope" : `máx ${a.maxScore}`}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {teams.map((team) => (
                <tr key={team.id} className="border-b border-beige-100 last:border-0">
                  <td className="sticky left-0 bg-white py-2 pr-3 font-bold text-forest-900">
                    {team.name}
                    {!team.active && <span className="ml-1 text-xs text-red-500">(inactivo)</span>}
                  </td>
                  {activities.map((activity) => {
                    const score = scoreMap.get(`${team.id}:${activity.id}`);
                    const evaluated = Boolean(score?.evaluated);
                    return (
                      <td key={activity.id} className="px-2 py-2 text-center">
                        <button
                          onClick={() => setScoreModal({ team: { id: team.id, name: team.name }, activity })}
                          className={`min-w-[56px] rounded-lg px-2.5 py-1.5 font-bold ${
                            evaluated
                              ? "bg-forest-100 text-forest-800 hover:bg-forest-200"
                              : "bg-beige-100 text-forest-400 hover:bg-beige-200"
                          }`}
                          title={evaluated ? "Evaluado" : "Sin evaluar"}
                        >
                          {evaluated ? score!.score ?? 0 : "—"}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <p className="mt-3 text-xs font-semibold text-forest-500">
          "—" significa <strong>sin evaluar</strong> y no cuenta como cero en el total.
        </p>
      </section>

      {activityModal && (
        <ActivityFormModal
          title={activityModal.activity ? "Editar actividad" : "Nueva actividad"}
          initial={
            activityModal.activity ? activityToForm(activityModal.activity) : EMPTY_ACTIVITY
          }
          busy={busy}
          onSave={saveActivity}
          onClose={() => setActivityModal(null)}
        />
      )}

      {scoreModal && (
        <ScoreModal
          team={scoreModal.team}
          activity={scoreModal.activity}
          existing={scoreMap.get(`${scoreModal.team.id}:${scoreModal.activity.id}`) ?? null}
          busy={busy}
          onSave={saveScore}
          onDelete={deleteScore}
          onClose={() => setScoreModal(null)}
        />
      )}

      {confirmDeleteActivity && (
        <ConfirmDialog
          title="Eliminar actividad"
          message={`Se eliminará "${confirmDeleteActivity.name}" y todos sus resultados. ¿Continuar?`}
          confirmLabel="Eliminar"
          danger
          busy={busy}
          onConfirm={deleteActivity}
          onClose={() => setConfirmDeleteActivity(null)}
        />
      )}
    </div>
  );
}
