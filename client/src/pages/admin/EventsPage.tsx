import { useCallback, useState } from "react";
import { Link } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, ArrowRight, Pencil, Play, CheckCircle2, XCircle } from "lucide-react";
import { api } from "@/api/client";
import { errorMessage, type EventItem } from "@/api/types";
import { useApi } from "@/hooks/useApi";
import { LoadingScreen } from "@/components/LoadingScreen";
import { Alert } from "@/components/Alert";
import { Badge } from "@/components/ProgressBar";
import { Modal, ConfirmDialog } from "@/components/Modal";

const eventSchema = z.object({
  name: z.string().trim().min(3, "El nombre es obligatorio"),
  description: z.string().trim().max(2000).optional().nullable(),
  date: z.string().min(1, "La fecha es obligatoria"),
  location: z.string().trim().max(200).optional().nullable(),
});

type FormValues = z.infer<typeof eventSchema>;

const STATUS: Record<string, { label: string; tone: "orange" | "green" | "gray" | "red" }> = {
  PREPARED: { label: "Preparado", tone: "orange" },
  IN_PROGRESS: { label: "En curso", tone: "green" },
  FINISHED: { label: "Finalizado", tone: "gray" },
  CANCELLED: { label: "Cancelado", tone: "red" },
};

export function EventsPage() {
  const fetchEvents = useCallback(() => api.get<{ events: EventItem[] }>("/api/v1/events").then((r) => r.events), []);
  const { data: events, loading, error, reload } = useApi<EventItem[]>(fetchEvents);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<EventItem | null>(null);
  const [confirm, setConfirm] = useState<{ type: "START" | "FINISH" | "CANCEL"; event: EventItem } | null>(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
  } = useForm<FormValues>({ resolver: zodResolver(eventSchema) });

  const openCreate = () => {
    setEditing(null);
    reset({});
    setActionError(null);
    setFormOpen(true);
  };

  const openEdit = (ev: EventItem) => {
    setEditing(ev);
    reset({
      name: ev.name,
      description: ev.description ?? "",
      date: ev.date.slice(0, 10),
      location: ev.location ?? "",
    });
    setActionError(null);
    setFormOpen(true);
  };

  const onSubmit = async (values: FormValues) => {
    setBusy(true);
    setActionError(null);
    try {
      const payload = {
        ...values,
        date: new Date(values.date + "T00:00:00.000Z").toISOString(),
      };
      if (editing) {
        await api.patch(`/api/v1/events/${editing.id}`, payload);
      } else {
        await api.post("/api/v1/events", payload);
      }
      setFormOpen(false);
      await reload();
    } catch (err) {
      setActionError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const doTransition = async () => {
    if (!confirm) return;
    setBusy(true);
    setActionError(null);
    try {
      const path =
        confirm.type === "START" ? "start" : confirm.type === "FINISH" ? "finish" : "cancel";
      await api.post(`/api/v1/events/${confirm.event.id}/${path}`);
      setConfirm(null);
      await reload();
    } catch (err) {
      setActionError(errorMessage(err));
      setConfirm(null);
    } finally {
      setBusy(false);
    }
  };

  if (loading && !events) return <LoadingScreen label="Cargando eventos…" />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-forest-900">Eventos</h1>
          <p className="text-sm font-semibold text-forest-600">Creá y gestioná la actividad de orientación.</p>
        </div>
        <button onClick={openCreate} className="btn-primary shrink-0">
          <Plus className="h-5 w-5" /> Nuevo evento
        </button>
      </div>

      {error && !events && <Alert tone="error">{error}</Alert>}
      {actionError && <Alert tone="error">{actionError}</Alert>}

      {!events || events.length === 0 ? (
        <div className="card text-center">
          <p className="font-bold text-forest-700">Todavía no hay eventos.</p>
          <p className="text-sm font-semibold text-forest-500">Creá el primer evento para empezar.</p>
        </div>
      ) : (
        <ul className="space-y-3">
          {events.map((ev) => {
            const s = STATUS[ev.status] ?? { label: ev.status, tone: "gray" as const };
            return (
              <li key={ev.id} className="card flex flex-col gap-3 sm:flex-row sm:items-center">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="font-display text-lg font-bold text-forest-900">{ev.name}</h2>
                    <Badge tone={s.tone}>{s.label}</Badge>
                  </div>
                  <p className="mt-0.5 text-sm font-semibold text-forest-600">
                    📅 {new Date(ev.date).toLocaleDateString("es")}
                    {ev.location ? ` • 📍 ${ev.location}` : ""}
                  </p>
                  <p className="mt-1 text-xs font-semibold text-forest-500">
                    {ev._count.teams} equipos · {ev._count.stations} postas · {ev._count.visits} visitas
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {ev.status === "PREPARED" && (
                    <button onClick={() => setConfirm({ type: "START", event: ev })} className="btn-primary px-4 py-2 text-sm">
                      <Play className="h-4 w-4" /> Iniciar
                    </button>
                  )}
                  {ev.status === "IN_PROGRESS" && (
                    <button onClick={() => setConfirm({ type: "FINISH", event: ev })} className="btn-orange px-4 py-2 text-sm">
                      <CheckCircle2 className="h-4 w-4" /> Finalizar
                    </button>
                  )}
                  {(ev.status === "PREPARED" || ev.status === "IN_PROGRESS") && (
                    <button onClick={() => setConfirm({ type: "CANCEL", event: ev })} className="btn-secondary px-4 py-2 text-sm">
                      <XCircle className="h-4 w-4" /> Cancelar
                    </button>
                  )}
                  <button onClick={() => openEdit(ev)} className="btn-secondary px-4 py-2 text-sm">
                    <Pencil className="h-4 w-4" /> Editar
                  </button>
                  <Link to={`/admin/eventos/${ev.id}/pizarra`} className="btn-secondary px-4 py-2 text-sm">
                    Gestionar <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {formOpen && (
        <Modal title={editing ? "Editar evento" : "Nuevo evento"} onClose={() => setFormOpen(false)}>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
            {actionError && <Alert tone="error">{actionError}</Alert>}
            <div>
              <label className="label">Nombre</label>
              <input className="input" {...register("name")} placeholder="Exploración de Ypacaraí 2026" />
              {errors.name && <p className="mt-1 text-sm font-semibold text-red-600">{errors.name.message}</p>}
            </div>
            <div>
              <label className="label">Descripción</label>
              <textarea className="input" rows={3} {...register("description")} placeholder="Descripción del evento…" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Fecha</label>
                <input type="date" className="input" {...register("date")} />
                {errors.date && <p className="mt-1 text-sm font-semibold text-red-600">{errors.date.message}</p>}
              </div>
              <div>
                <label className="label">Ubicación</label>
                <input className="input" {...register("location")} placeholder="Reserva Natural…" />
              </div>
            </div>
            <button type="submit" disabled={isSubmitting || busy} className="btn-primary w-full">
              {editing ? "Guardar cambios" : "Crear evento"}
            </button>
          </form>
        </Modal>
      )}

      {confirm && (
        <ConfirmDialog
          title={
            confirm.type === "START" ? "Iniciar evento" : confirm.type === "FINISH" ? "Finalizar evento" : "Cancelar evento"
          }
          message={
            confirm.type === "START"
              ? `Se pondrá en marcha "${confirm.event.name}". Los equipos podrán escanear postas. ¿Continuar?`
              : confirm.type === "FINISH"
                ? `Se finalizará "${confirm.event.name}" y se conservarán los resultados. ¿Continuar?`
                : `Se cancelará "${confirm.event.name}". Esta acción no se puede deshacer fácilmente. ¿Continuar?`
          }
          confirmLabel="Confirmar"
          danger={confirm.type === "CANCEL"}
          busy={busy}
          onConfirm={() => void doTransition()}
          onClose={() => setConfirm(null)}
        />
      )}
    </div>
  );
}