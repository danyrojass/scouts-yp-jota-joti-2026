import { useCallback, useState } from "react";
import { useParams, useSearchParams, Link } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, Pencil, RotateCcw, KeyRound, Trophy, Route, Compass, ListChecks, SkipForward, Undo2 } from "lucide-react";
import { api } from "@/api/client";
import { errorMessage, type Dashboard, type EventItem, type TeamDetail, type TeamItem, type VisitStatus } from "@/api/types";
import { useApi } from "@/hooks/useApi";
import { LoadingScreen } from "@/components/LoadingScreen";
import { Alert } from "@/components/Alert";
import { Badge, ProgressBar } from "@/components/ProgressBar";
import { Modal, ConfirmDialog } from "@/components/Modal";
import { AdminRankingPage } from "@/pages/admin/RankingPage";

const teamSchema = z.object({
  name: z.string().trim().min(1, "Nombre obligatorio"),
  username: z.string().trim().min(3, "Mínimo 3 caracteres").regex(/^[a-zA-Z0-9_.]+$/, "Solo letras, números, punto y guion bajo"),
  password: z.string().trim().min(6, "Mínimo 6 caracteres"),
  active: z.boolean(),
});

type FormValues = z.infer<typeof teamSchema>;

export function TeamsPage() {
  const { eventId = "" } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = searchParams.get("tab") === "ranking" ? "ranking" : "equipos";
  const fetchEvent = useCallback(() => api.get<{ event: EventItem }>(`/api/v1/events/${eventId}`).then((r) => r.event), [eventId]);
  const fetchDashboard = useCallback(() => api.get<Dashboard>(`/api/v1/admin/dashboard?eventId=${eventId}`).then((r) => r), [eventId]);
  const { data: event } = useApi<EventItem>(fetchEvent, [eventId]);
  const { data: dashboard, loading, error, reload } = useApi<Dashboard>(fetchDashboard, [eventId]);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<TeamItem | null>(null);
  const [confirmReset, setConfirmReset] = useState<TeamItem | null>(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [manageTeam, setManageTeam] = useState<{ id: string; name: string } | null>(null);
  const [teamDetail, setTeamDetail] = useState<TeamDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [skipTarget, setSkipTarget] = useState<{ stationId: string; stationName: string } | null>(null);
  const [skipReason, setSkipReason] = useState("");

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
  } = useForm<FormValues>({ resolver: zodResolver(teamSchema) });

  const openCreate = () => {
    setEditing(null);
    reset({ active: true });
    setActionError(null);
    setFormOpen(true);
  };

  const openEdit = (t: TeamItem) => {
    setEditing(t);
    reset({ name: t.name, username: t.username, password: "", active: t.active });
    setActionError(null);
    setFormOpen(true);
  };

  const onSubmit = async (values: FormValues) => {
    setBusy(true);
    setActionError(null);
    try {
      if (editing) {
        const payload: Record<string, unknown> = {
          name: values.name,
          active: values.active,
        };
        if (values.password) payload.password = values.password;
        await api.patch(`/api/v1/teams/${editing.id}`, payload);
      } else {
        await api.post("/api/v1/teams", { ...values, eventId });
      }
      setFormOpen(false);
      await reload();
    } catch (err) {
      setActionError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const doReset = async () => {
    if (!confirmReset) return;
    setBusy(true);
    try {
      await api.post(`/api/v1/teams/${confirmReset.id}/reset-progress`, { confirm: true });
      setConfirmReset(null);
      await reload();
    } catch (err) {
      setActionError(errorMessage(err));
      setConfirmReset(null);
    } finally {
      setBusy(false);
    }
  };

  const loadTeamDetail = useCallback(async (teamId: string) => {
    const res = await api.get<{ team: TeamDetail }>(`/api/v1/teams/${teamId}`);
    return res.team;
  }, []);

  const openManage = async (team: { id: string; name: string }) => {
    setManageTeam(team);
    setTeamDetail(null);
    setDetailError(null);
    setSkipTarget(null);
    setSkipReason("");
    setDetailLoading(true);
    try {
      setTeamDetail(await loadTeamDetail(team.id));
    } catch (err) {
      setDetailError(errorMessage(err));
    } finally {
      setDetailLoading(false);
    }
  };

  const refreshDetail = async () => {
    if (!manageTeam) return;
    setTeamDetail(await loadTeamDetail(manageTeam.id));
  };

  const doSkip = async () => {
    if (!manageTeam || !skipTarget) return;
    setBusy(true);
    setDetailError(null);
    try {
      await api.post(`/api/v1/teams/${manageTeam.id}/skip-station`, {
        stationId: skipTarget.stationId,
        reason: skipReason.trim() || undefined,
      });
      setSkipTarget(null);
      setSkipReason("");
      await refreshDetail();
      await reload();
    } catch (err) {
      setDetailError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const doUnskip = async (stationId: string) => {
    if (!manageTeam) return;
    setBusy(true);
    setDetailError(null);
    try {
      await api.post(`/api/v1/teams/${manageTeam.id}/unskip-station`, { stationId });
      await refreshDetail();
      await reload();
    } catch (err) {
      setDetailError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const eventInProgress = event?.status === "IN_PROGRESS";
  const rows = dashboard?.teams ?? [];

  const detailStatus = new Map<string, VisitStatus>();
  if (teamDetail) {
    for (const v of teamDetail.visits) {
      if (v.status === "VALID") detailStatus.set(v.stationId, "VALID");
      else if (v.status === "SKIPPED" && detailStatus.get(v.stationId) !== "VALID")
        detailStatus.set(v.stationId, "SKIPPED");
    }
  }
  const detailStops = teamDetail
    ? [...teamDetail.routeStops].sort((a, b) => a.position - b.position)
    : [];

  const subTabs = (
    <div className="flex gap-2">
      <button
        onClick={() => setSearchParams({})}
        className={`flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-bold transition-colors ${
          tab === "equipos" ? "bg-forest-700 text-white" : "bg-white text-forest-700 hover:bg-forest-50"
        }`}
      >
        <Compass className="h-4 w-4" /> Equipos
      </button>
      <button
        onClick={() => setSearchParams({ tab: "ranking" })}
        className={`flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-bold transition-colors ${
          tab === "ranking" ? "bg-forest-700 text-white" : "bg-white text-forest-700 hover:bg-forest-50"
        }`}
      >
        <Trophy className="h-4 w-4" /> Ranking
      </button>
    </div>
  );

  if (loading && !dashboard) return <LoadingScreen label="Cargando equipos…" />;

  if (tab === "ranking") {
    return (
      <div className="space-y-4">
        {subTabs}
        <AdminRankingPage />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {subTabs}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-bold text-forest-900">Equipos</h2>
          <p className="text-sm font-semibold text-forest-600">
            Creá, editá y supervisá las cuentas de los equipos.
          </p>
        </div>
        <button onClick={openCreate} className="btn-primary">
          <Plus className="h-5 w-5" /> Nuevo equipo
        </button>
      </div>

      {error && !dashboard && <Alert tone="error">{error}</Alert>}
      {actionError && <Alert tone="error">{actionError}</Alert>}

      {eventInProgress && (
        <Alert tone="warning">
          El evento está en curso. Podés crear equipos y administrar cuentas, pero los itinerarios
          requieren confirmación especial para modificarse.
        </Alert>
      )}

      <section className="card overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="border-b border-beige-200 text-left text-xs font-bold uppercase tracking-wide text-forest-500">
              <th className="py-2 pr-3">Equipo</th>
              <th className="py-2 pr-3">Usuario</th>
              <th className="py-2 pr-3">Progreso</th>
              <th className="py-2 pr-3">Itinerario</th>
              <th className="py-2 pr-3">Estado</th>
              <th className="py-2 pr-3 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((t) => (
              <tr key={t.teamId} className="border-b border-beige-100 last:border-0 hover:bg-forest-50/50">
                <td className="py-2.5 pr-3 font-bold text-forest-900">{t.team}</td>
                <td className="py-2.5 pr-3 font-semibold text-forest-600">{t.username}</td>
                <td className="w-40 py-2.5 pr-3">
                  <div className="flex items-center gap-2">
                    <ProgressBar value={t.completed} max={t.totalStops} className="h-2.5 w-20" />
                    <span className="font-bold text-forest-700">{t.completed}/{t.totalStops}</span>
                  </div>
                  {t.skipped > 0 && (
                    <p className="mt-0.5 text-xs font-semibold text-amber-700">
                      {t.skipped} saltada{t.skipped === 1 ? "" : "s"}
                    </p>
                  )}
                </td>
                <td className="py-2.5 pr-3">
                  <Link
                    to={`../itinerarios?team=${t.teamId}`}
                    className="inline-flex items-center gap-1 rounded-xl bg-forest-50 px-2.5 py-1.5 text-xs font-bold text-forest-700 hover:bg-forest-100"
                  >
                    <Route className="h-4 w-4" /> Ver
                  </Link>
                </td>
                <td className="py-2.5 pr-3">
                  {t.active ? <Badge tone="green">Activo</Badge> : <Badge tone="red">Inactivo</Badge>}
                </td>
                <td className="py-2.5 pr-3">
                  <div className="flex justify-end gap-1.5">
                    <button
                      onClick={() => void openManage({ id: t.teamId, name: t.team })}
                      className="rounded-xl p-2 text-forest-600 hover:bg-forest-50"
                      title="Postas y recuperación"
                    >
                      <ListChecks className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => openEdit({ id: t.teamId, eventId, name: t.team, username: t.username, active: t.active, createdAt: "", updatedAt: "" } as TeamItem)}
                      className="rounded-xl p-2 text-forest-600 hover:bg-forest-50"
                      title="Editar"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    {t.completed > 0 && (
                      <button
                        onClick={() => setConfirmReset({ id: t.teamId, name: t.team, username: t.username, active: t.active, eventId, createdAt: "", updatedAt: "" } as TeamItem)}
                        className="rounded-xl p-2 text-clay-600 hover:bg-clay-50"
                        title="Reiniciar progreso"
                      >
                        <RotateCcw className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="py-6 text-center font-semibold text-forest-500">
                  Sin equipos todavía. Creá el primero con el botón "Nuevo equipo".
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>

      <div className="card flex items-start gap-3 text-sm">
        <KeyRound className="mt-0.5 h-5 w-5 shrink-0 text-clay-600" />
        <p className="font-semibold text-forest-600">
          Entregá el usuario y la contraseña a cada equipo antes del evento. Los equipos inician sesión
          en esta misma web y escanean los códigos QR de las postas.
        </p>
      </div>

      {formOpen && (
        <Modal title={editing ? `Editar equipo: ${editing.name}` : "Nuevo equipo"} onClose={() => setFormOpen(false)}>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
            {actionError && <Alert tone="error">{actionError}</Alert>}
            <div>
              <label className="label">Nombre visible</label>
              <input className="input" {...register("name")} placeholder="Aguará" />
              {errors.name && <p className="mt-1 text-sm font-semibold text-red-600">{errors.name.message}</p>}
            </div>
            <div>
              <label className="label">Nombre de usuario</label>
              <input className="input" {...register("username")} placeholder="aguara" autoComplete="off" />
              {errors.username && <p className="mt-1 text-sm font-semibold text-red-600">{errors.username.message}</p>}
            </div>
            <div>
              <label className="label">{editing ? "Nueva contraseña (dejar vacío para mantener)" : "Contraseña"}</label>
              <input type="text" className="input" {...register("password")} placeholder="mínimo 6 caracteres" autoComplete="off" />
              {errors.password && <p className="mt-1 text-sm font-semibold text-red-600">{errors.password.message}</p>}
            </div>
            <label className="flex items-center gap-2 font-bold text-forest-800">
              <input type="checkbox" {...register("active")} className="h-4 w-4 accent-forest-700" />
              Cuenta activa
            </label>
            <button type="submit" disabled={isSubmitting || busy} className="btn-primary w-full">
              {editing ? "Guardar cambios" : "Crear equipo"}
            </button>
          </form>
        </Modal>
      )}

      {confirmReset && (
        <ConfirmDialog
          title="Reiniciar progreso"
          message={`Se borrará todo el progreso del equipo "${confirmReset.name}" (visitas y respuestas registradas). Esta acción genera un registro de auditoría. ¿Continuar?`}
          confirmLabel="Reiniciar progreso"
          danger
          busy={busy}
          onConfirm={() => void doReset()}
          onClose={() => setConfirmReset(null)}
        />
      )}

      {manageTeam && (
        <Modal title={`Postas de ${manageTeam.name}`} onClose={() => setManageTeam(null)}>
          <div className="space-y-4">
            {detailError && <Alert tone="error">{detailError}</Alert>}
            <p className="text-sm font-semibold text-forest-600">
              Si el equipo perdió el QR de una posta, podés marcarla como <strong>saltada</strong> (cuenta
              como semi-completada). Nunca se reemplaza una posta ya completada.
            </p>

            {detailLoading && !teamDetail ? (
              <p className="py-4 text-center text-sm font-semibold text-forest-500">Cargando postas…</p>
            ) : detailStops.length === 0 ? (
              <p className="py-4 text-center text-sm font-semibold text-forest-500">
                Este equipo no tiene itinerario asignado.
              </p>
            ) : (
              <>
                {teamDetail && (
                  <div className="flex items-center gap-2 text-xs font-bold text-forest-500">
                    <span>{teamDetail.progress.completed}/{teamDetail.progress.total} resueltas</span>
                    <span className="text-forest-300">·</span>
                    <span className="text-amber-700">{teamDetail.progress.skipped} saltadas</span>
                  </div>
                )}
                <ol className="space-y-2">
                  {detailStops.map((stop, i) => {
                    const status = detailStatus.get(stop.stationId);
                    return (
                      <li
                        key={stop.id}
                        className="flex items-center gap-2 rounded-2xl border border-beige-200 bg-beige-50 px-3 py-2"
                      >
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-forest-700 text-xs font-extrabold text-white">
                          {i + 1}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-bold text-forest-900">{stop.station.name}</p>
                          {status !== "VALID" && stop.station.rescuePhrase && (
                            <p className="truncate text-xs font-semibold text-forest-500">
                              Rescate: <span className="text-forest-700">{stop.station.rescuePhrase}</span>
                            </p>
                          )}
                        </div>
                        {status === "VALID" ? (
                          <Badge tone="green">Completada</Badge>
                        ) : status === "SKIPPED" ? (
                          <>
                            <Badge tone="orange">Saltada</Badge>
                            <button
                              onClick={() => void doUnskip(stop.stationId)}
                              disabled={busy}
                              className="rounded-lg p-1.5 text-forest-600 hover:bg-forest-100 disabled:opacity-50"
                              title="Deshacer salto"
                            >
                              <Undo2 className="h-4 w-4" />
                            </button>
                          </>
                        ) : (
                          <>
                            <Badge tone="gray">Pendiente</Badge>
                            <button
                              onClick={() => {
                                setSkipTarget({ stationId: stop.stationId, stationName: stop.station.name });
                                setSkipReason("");
                              }}
                              disabled={busy}
                              className="inline-flex items-center gap-1 rounded-xl bg-clay-50 px-2.5 py-1.5 text-xs font-bold text-clay-700 hover:bg-clay-100 disabled:opacity-50"
                              title="Saltar posta"
                            >
                              <SkipForward className="h-3.5 w-3.5" /> Saltar
                            </button>
                          </>
                        )}
                      </li>
                    );
                  })}
                </ol>
                <button onClick={() => void refreshDetail()} disabled={detailLoading} className="btn-secondary w-full">
                  Refrescar
                </button>
              </>
            )}
          </div>
        </Modal>
      )}

      {skipTarget && manageTeam && (
        <Modal
          title={`Saltar "${skipTarget.stationName}"`}
          onClose={() => setSkipTarget(null)}
        >
          <div className="space-y-4">
            <p className="text-sm font-semibold text-forest-600">
              La posta quedará marcada como <strong>saltada</strong> para {manageTeam.name}. El puntaje de
              recorrido se recalcula automáticamente y la acción queda auditada.
            </p>
            <div>
              <label className="label">Motivo (opcional)</label>
              <textarea
                className="input"
                rows={2}
                maxLength={300}
                value={skipReason}
                onChange={(e) => setSkipReason(e.target.value)}
                placeholder="Ej.: el QR estaba deteriorado y los coordinadores autorizaron el salto."
              />
            </div>
            <button onClick={() => void doSkip()} disabled={busy} className="btn-primary w-full">
              <SkipForward className="h-5 w-5" /> Confirmar salto
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}