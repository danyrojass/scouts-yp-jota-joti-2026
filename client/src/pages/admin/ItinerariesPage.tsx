import { useCallback, useState } from "react";
import { useParams } from "react-router-dom";
import { ArrowUp, ArrowDown, Save, Route as RouteIcon } from "lucide-react";
import { api } from "@/api/client";
import { errorMessage, type EventItem, type StationItem, type TeamItem } from "@/api/types";
import { useApi } from "@/hooks/useApi";
import { LoadingScreen } from "@/components/LoadingScreen";
import { Alert } from "@/components/Alert";
import { Badge } from "@/components/ProgressBar";
import { ConfirmDialog } from "@/components/Modal";

type TeamWithStops = TeamItem & { stationNames?: Record<string, string> };

export function ItinerariesPage() {
  const { eventId = "" } = useParams();
  const fetchEvent = useCallback(() => api.get<{ event: EventItem }>(`/api/v1/events/${eventId}`).then((r) => r.event), [eventId]);
  const { data: event } = useApi<EventItem>(fetchEvent, [eventId]);
  const fetchData = useCallback(
    () =>
      Promise.all([
        api.get<{ event: EventItem }>(`/api/v1/events/${eventId}`),
        api.get<{ stations: StationItem[] }>(`/api/v1/stations?eventId=${eventId}`),
      ]).then(([ev, st]) => ({ event: ev.event, stations: st.stations })),
    [eventId]
  );
  const { data, loading, error, reload } = useApi<{ event: EventItem; stations: StationItem[] }>(fetchData, [eventId]);

  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
  const [draft, setDraft] = useState<string[]>([]);
  const [confirmForce, setConfirmForce] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<{ tone: "success" | "error"; msg: string } | null>(null);

  if (loading && !data) return <LoadingScreen label="Cargando itinerarios…" />;
  if (error && !data) return <Alert tone="error">{error}</Alert>;
  if (!data || !event) return null;

  const teams: TeamWithStops[] = (data.event as unknown as { teams: TeamItem[] }).teams ?? [];
  const stations = data.stations;
  const stationName = (id: string) => stations.find((s) => s.id === id)?.name ?? "Posta desconocida";
  const eventInProgress = event.status === "IN_PROGRESS";

  const selectedTeam = teams.find((t) => t.id === selectedTeamId) ?? null;
  const stopInfo = new Map((selectedTeam?.routeStops ?? []).map((s) => [s.stationId, s]));
  const questionCount = (t: TeamItem) => (t.routeStops ?? []).filter((s) => s.question).length;

  const openTeam = (teamId: string) => {
    setSelectedTeamId(teamId);
    setSaveMsg(null);
    const team = teams.find((t) => t.id === teamId);
    const stops = team?.routeStops ?? [];
    setDraft([...stops].sort((a, b) => a.position - b.position).map((s) => s.stationId));
  };

  const move = (index: number, dir: -1 | 1) => {
    setDraft((prev) => {
      const next = [...prev];
      const target = index + dir;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  const toggleStation = (stationId: string) => {
    setDraft((prev) => (prev.includes(stationId) ? prev.filter((id) => id !== stationId) : [...prev, stationId]));
  };

  const save = async (force: boolean) => {
    if (!selectedTeamId) return;
    setSaving(true);
    setSaveMsg(null);
    try {
      await api.put(`/api/v1/teams/${selectedTeamId}/route`, { stationIds: draft, force });
      setConfirmForce(false);
      setSaveMsg({ tone: "success", msg: "Itinerario guardado correctamente." });
      await reload();
    } catch (err) {
      setSaveMsg({ tone: "error", msg: errorMessage(err) });
    } finally {
      setSaving(false);
    }
  };

  const onSaveClick = () => {
    if (eventInProgress) setConfirmForce(true);
    else void save(false);
  };

  const remaining = stations.filter((s) => !draft.includes(s.id));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-bold text-forest-900">Itinerarios</h2>
          <p className="text-sm font-semibold text-forest-600">
            Definí el orden de postas de cada equipo. Los QRs físicos son los mismos para todos.
          </p>
        </div>
      </div>

      {eventInProgress && (
        <Alert tone="warning">
          El evento está en curso. Los cambios requieren confirmación excepcional y quedan registrados en auditoría.
        </Alert>
      )}

      <div className="grid gap-4 lg:grid-cols-[1fr_1.2fr]">
        <section className="card">
          <h3 className="mb-3 font-display text-lg font-bold text-forest-900">Equipos</h3>
          <ul className="space-y-2">
            {teams.map((t) => {
              const stops = [...(t.routeStops ?? [])].sort((a, b) => a.position - b.position);
              const configured = stops.length >= 2;
              return (
                <li key={t.id}>
                  <button
                    onClick={() => openTeam(t.id)}
                    className={`w-full rounded-2xl border px-4 py-3 text-left transition-colors ${
                      selectedTeamId === t.id ? "border-clay-400 bg-clay-50" : "border-beige-200 bg-white hover:bg-forest-50"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-bold text-forest-900">{t.name}</p>
                      <div className="flex shrink-0 items-center gap-1.5">
                        {questionCount(t) > 0 && <Badge tone="orange">{questionCount(t)} preguntas</Badge>}
                        {configured ? <Badge tone="green">{stops.length} postas</Badge> : <Badge tone="red">Sin configurar</Badge>}
                      </div>
                    </div>
                  </button>
                </li>
              );
            })}
            {teams.length === 0 && (
              <li className="text-sm font-semibold text-forest-500">Creá equipos para asignar itinerarios.</li>
            )}
          </ul>
        </section>

        <section className="card">
          <div className="mb-3 flex items-center gap-2">
            <RouteIcon className="h-5 w-5 text-clay-600" />
            <h3 className="font-display text-lg font-bold text-forest-900">
              {selectedTeamId ? `Orden de ${teams.find((t) => t.id === selectedTeamId)?.name ?? ""}` : "Seleccioná un equipo"}
            </h3>
          </div>

          {!selectedTeamId ? (
            <p className="text-sm font-semibold text-forest-500">
              Elegí un equipo de la lista para armar su recorrido.
            </p>
          ) : (
            <div className="space-y-4">
              {saveMsg && <Alert tone={saveMsg.tone}>{saveMsg.msg}</Alert>}
              <p className="text-xs font-bold uppercase tracking-wide text-forest-500">Postas del itinerario (en orden)</p>
              <ol className="space-y-2">
                {draft.map((stationId, i) => {
                  const stop = stopInfo.get(stationId);
                  const graded = !!stop?.questionAnswer;
                  return (
                    <li key={stationId} className="rounded-2xl border border-beige-200 bg-beige-50 px-3 py-2">
                      <div className="flex items-center gap-2">
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-forest-700 text-xs font-extrabold text-white">
                          {i + 1}
                        </span>
                        <span className="min-w-0 flex-1 truncate font-bold text-forest-900">{stationName(stationId)}</span>
                        <button onClick={() => move(i, -1)} disabled={i === 0} className="rounded-lg p-1.5 text-forest-600 hover:bg-forest-100 disabled:opacity-30">
                          <ArrowUp className="h-4 w-4" />
                        </button>
                        <button onClick={() => move(i, 1)} disabled={i === draft.length - 1} className="rounded-lg p-1.5 text-forest-600 hover:bg-forest-100 disabled:opacity-30">
                          <ArrowDown className="h-4 w-4" />
                        </button>
                        <button onClick={() => toggleStation(stationId)} className="rounded-lg p-1.5 text-red-500 hover:bg-red-50">
                          ✕
                        </button>
                      </div>
                      {stop?.question && (
                        <div className="mt-2 rounded-xl border border-clay-200 bg-white px-3 py-2">
                          <div className="flex items-start gap-2">
                            <Badge tone={graded ? "orange" : "beige"}>{graded ? "Pregunta" : "Pregunta libre"}</Badge>
                            <span className="text-sm font-semibold text-forest-800">{stop.question}</span>
                          </div>
                          {graded && (
                            <p className="mt-1 text-xs font-bold text-forest-500">
                              Respuesta esperada: <span className="text-forest-800">{stop.questionAnswer}</span>
                            </p>
                          )}
                        </div>
                      )}
                    </li>
                  );
                })}
                {draft.length === 0 && (
                  <li className="rounded-2xl border border-dashed border-beige-300 p-4 text-center text-sm font-semibold text-forest-500">
                    Agregá postas desde el panel de la derecha.
                  </li>
                )}
              </ol>

              {remaining.length > 0 && (
                <>
                  <p className="text-xs font-bold uppercase tracking-wide text-forest-500">Agregar posta</p>
                  <div className="flex flex-wrap gap-2">
                    {remaining.map((s) => (
                      <button
                        key={s.id}
                        onClick={() => toggleStation(s.id)}
                        className="rounded-full border border-forest-300 bg-white px-3 py-1.5 text-sm font-bold text-forest-700 hover:bg-forest-50"
                      >
                        + {s.name}
                      </button>
                    ))}
                  </div>
                </>
              )}

              <div className="flex items-center justify-between gap-3 border-t border-beige-200 pt-4">
                <p className="text-xs font-semibold text-forest-500">{draft.length} postas en el recorrido</p>
                <button onClick={onSaveClick} disabled={saving || draft.length < 2} className="btn-primary">
                  <Save className="h-5 w-5" /> Guardar itinerario
                </button>
              </div>
              {draft.length < 2 && (
                <p className="text-xs font-bold text-clay-600">Se requieren al menos 2 postas.</p>
              )}
            </div>
          )}
        </section>
      </div>

      {confirmForce && (
        <ConfirmDialog
          title="Modificar itinerario en curso"
          message="El evento está en curso. La modificación excepcional de este itinerario quedará registrada en auditoría. ¿Continuar?"
          confirmLabel="Confirmar cambio excepcional"
          danger
          busy={saving}
          onConfirm={() => void save(true)}
          onClose={() => setConfirmForce(false)}
        />
      )}
    </div>
  );
}