import { useCallback, useState } from "react";
import { useParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, Pencil, Trash2, Printer, ShieldAlert, Upload } from "lucide-react";
import { api } from "@/api/client";
import { errorMessage, type EventItem, type StationItem } from "@/api/types";
import { useApi } from "@/hooks/useApi";
import { LoadingScreen } from "@/components/LoadingScreen";
import { Alert } from "@/components/Alert";
import { Badge } from "@/components/ProgressBar";
import { Modal, ConfirmDialog } from "@/components/Modal";

const CHALLENGE_TYPES = [
  { value: "CODE", label: "Código / palabra", hint: "El equipo debe escribir un código o palabra obtenido en la posta." },
  { value: "QUESTION", label: "Pregunta escrita", hint: "El equipo responde una pregunta; se compara con la respuesta esperada." },
  { value: "CONFIRMATION", label: "Confirmación de visita", hint: "Solo deben confirmar su presencia. No hace falta respuesta." },
  { value: "AUTO", label: "Evaluación automática", hint: "Acepta cualquier respuesta no vacía (o usá respuesta esperada)." },
];

const stationSchema = z
  .object({
    name: z.string().trim().min(2, "Nombre obligatorio"),
    description: z.string().trim().max(2000).optional().nullable(),
    challengeType: z.enum(["CODE", "QUESTION", "CONFIRMATION", "AUTO"]),
    instructions: z.string().trim().max(2000).optional().nullable(),
    displayedCode: z.string().trim().max(200).optional().nullable(),
    expectedAnswer: z.string().trim().max(500).optional().nullable(),
    autoAcceptAny: z.boolean(),
    active: z.boolean(),
    latitude: z
      .string()
      .trim()
      .optional()
      .nullable()
      .refine(
        (v) => !v || (Number.isFinite(Number(v)) && Number(v) >= -90 && Number(v) <= 90),
        "Latitud inválida (-90 a 90)"
      ),
    longitude: z
      .string()
      .trim()
      .optional()
      .nullable()
      .refine(
        (v) => !v || (Number.isFinite(Number(v)) && Number(v) >= -180 && Number(v) <= 180),
        "Longitud inválida (-180 a 180)"
      ),
  })
  .superRefine((v, ctx) => {
    const hasLat = Boolean(v.latitude && v.latitude.trim() !== "");
    const hasLng = Boolean(v.longitude && v.longitude.trim() !== "");
    if (hasLat !== hasLng) {
      ctx.addIssue({
        code: "custom",
        path: ["latitude"],
        message: "Completá latitud y longitud juntas.",
      });
    }
  });

type FormValues = z.infer<typeof stationSchema>;

const TYPE_BADGE: Record<string, { label: string; tone: "forest" | "orange" | "green" | "beige" | "gray" }> = {
  CODE: { label: "Código", tone: "forest" },
  QUESTION: { label: "Pregunta", tone: "orange" },
  CONFIRMATION: { label: "Confirmación", tone: "green" },
  AUTO: { label: "Automática", tone: "beige" },
};

export function StationsPage() {
  const { eventId = "" } = useParams();
  const fetchEvent = useCallback(() => api.get<{ event: EventItem }>(`/api/v1/events/${eventId}`).then((r) => r.event), [eventId]);
  const { data: event } = useApi<EventItem>(fetchEvent, [eventId]);
  const fetchStations = useCallback(() => api.get<{ stations: StationItem[] }>(`/api/v1/stations?eventId=${eventId}`).then((r) => r.stations), [eventId]);
  const { data: stations, loading, error, reload } = useApi<StationItem[]>(fetchStations, [eventId]);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<StationItem | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<StationItem | null>(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [csvText, setCsvText] = useState("");
  const [importBusy, setImportBusy] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [importResult, setImportResult] = useState<{
    updated: number;
    parsed: number;
    errors: { row: number; error: string }[];
  } | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
    watch,
  } = useForm<FormValues>({ resolver: zodResolver(stationSchema) });

  const challengeType = watch("challengeType");
  const needsAnswer = challengeType !== undefined && challengeType !== "CONFIRMATION";

  const openCreate = () => {
    setEditing(null);
    reset({ challengeType: "CODE", autoAcceptAny: false, active: true, latitude: "", longitude: "" });
    setActionError(null);
    setFormOpen(true);
  };

  const openEdit = (s: StationItem) => {
    setEditing(s);
    reset({
      name: s.name,
      description: s.description ?? "",
      challengeType: s.challengeType,
      instructions: s.instructions ?? "",
      displayedCode: s.displayedCode ?? "",
      expectedAnswer: s.expectedAnswer ?? "",
      autoAcceptAny: s.autoAcceptAny,
      active: s.active,
      latitude: s.latitude != null ? String(s.latitude) : "",
      longitude: s.longitude != null ? String(s.longitude) : "",
    });
    setActionError(null);
    setFormOpen(true);
  };

  const onSubmit = async (values: FormValues) => {
    setBusy(true);
    setActionError(null);
    try {
      const { latitude, longitude, ...rest } = values;
      const payload = {
        ...rest,
        latitude: latitude && latitude.trim() !== "" ? Number(latitude) : null,
        longitude: longitude && longitude.trim() !== "" ? Number(longitude) : null,
      } as Record<string, unknown>;
      if (payload.challengeType === "CONFIRMATION") {
        payload.expectedAnswer = null;
        payload.autoAcceptAny = false;
      }
      if (editing) {
        await api.patch(`/api/v1/stations/${editing.id}`, payload);
      } else {
        await api.post("/api/v1/stations", { ...payload, eventId });
      }
      setFormOpen(false);
      await reload();
    } catch (err) {
      setActionError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const runImport = async () => {
    setImportBusy(true);
    setImportError(null);
    setImportResult(null);
    try {
      const result = await api.post<{
        updated: number;
        parsed: number;
        errors: { row: number; error: string }[];
      }>("/api/v1/stations/import", { eventId, csv: csvText });
      setImportResult(result);
      await reload();
    } catch (err) {
      setImportError(errorMessage(err));
    } finally {
      setImportBusy(false);
    }
  };

  const onCsvFile = (file: File | null) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setCsvText(String(reader.result ?? ""));
    reader.readAsText(file);
  };

  const doDelete = async () => {
    if (!confirmDelete) return;
    setBusy(true);
    try {
      await api.del(`/api/v1/stations/${confirmDelete.id}`);
      setConfirmDelete(null);
      await reload();
    } catch (err) {
      setActionError(errorMessage(err));
      setConfirmDelete(null);
    } finally {
      setBusy(false);
    }
  };

  const eventInProgress = event?.status === "IN_PROGRESS";

  if (loading && !stations) return <LoadingScreen label="Cargando postas…" />;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-bold text-forest-900">Postas</h2>
          <p className="text-sm font-semibold text-forest-600">
            Configurá los desafíos y generá los códigos QR.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => { setImportOpen(true); setCsvText(""); setImportResult(null); setImportError(null); }} className="btn-secondary">
            <Upload className="h-5 w-5" /> Importar CSV
          </button>
          <button onClick={openCreate} className="btn-primary">
            <Plus className="h-5 w-5" /> Nueva posta
          </button>
        </div>
      </div>

      {error && !stations && <Alert tone="error">{error}</Alert>}
      {actionError && <Alert tone="error">{actionError}</Alert>}

      {eventInProgress && (
        <Alert tone="warning">El evento está en curso: se mantiene la configuración de las postas.</Alert>
      )}

      {stations && stations.some((s) => s.latitude == null || s.longitude == null) && (
        <Alert tone="warning">
          Hay postas sin coordenadas. No aparecerán en el mapa de itinerario de los equipos.
        </Alert>
      )}

      <div className="card flex items-start gap-3 text-sm">
        <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-clay-600" />
        <p className="font-semibold text-forest-600">
          Las respuestas esperadas y códigos secretos se guardan solo en el servidor y nunca se
          muestran a los equipos. El QR solo contiene la URL de la posta.
        </p>
      </div>

      {!stations || stations.length === 0 ? (
        <div className="card text-center">
          <p className="font-bold text-forest-700">Sin postas configuradas.</p>
          <p className="text-sm font-semibold text-forest-500">Creá la primera posta del recorrido.</p>
        </div>
      ) : (
        <ul className="space-y-3">
          {stations.map((s) => {
            const tb = TYPE_BADGE[s.challengeType] ?? { label: s.challengeType, tone: "beige" as const };
            return (
              <li key={s.id} className="card flex flex-col gap-3 sm:flex-row sm:items-center">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-display text-lg font-bold text-forest-900">{s.name}</h3>
                    <Badge tone={tb.tone}>{tb.label}</Badge>
                    {s.active ? <Badge tone="green">Activa</Badge> : <Badge tone="red">Inactiva</Badge>}
                  </div>
                  {s.description && <p className="mt-0.5 text-sm font-semibold text-forest-600">{s.description}</p>}
                  <p className="mt-1 truncate font-mono text-xs text-forest-500">/posta/{s.publicToken}</p>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => window.open(`/api/v1/stations/${s.id}/qr`, "_blank")} className="btn-secondary px-4 py-2 text-sm">
                    <Printer className="h-4 w-4" /> QR
                  </button>
                  <button onClick={() => openEdit(s)} className="btn-secondary px-4 py-2 text-sm">
                    <Pencil className="h-4 w-4" /> Editar
                  </button>
                  {!eventInProgress && (
                    <button onClick={() => setConfirmDelete(s)} className="btn-secondary px-4 py-2 text-sm text-red-600 hover:bg-red-50">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <div className="card">
        <h3 className="mb-3 font-display text-lg font-bold text-forest-900">Tipos de desafío</h3>
        <ul className="grid gap-2 sm:grid-cols-2">
          {CHALLENGE_TYPES.map((c) => (
            <li key={c.value} className="rounded-2xl bg-beige-50 p-3">
              <p className="font-bold text-forest-900">{c.label}</p>
              <p className="text-xs font-semibold text-forest-600">{c.hint}</p>
            </li>
          ))}
        </ul>
      </div>

      {formOpen && (
        <Modal title={editing ? `Editar posta: ${editing.name}` : "Nueva posta"} onClose={() => setFormOpen(false)}>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
            {actionError && <Alert tone="error">{actionError}</Alert>}
            <div>
              <label className="label">Nombre</label>
              <input className="input" {...register("name")} placeholder="Mirador del Lago" />
              {errors.name && <p className="mt-1 text-sm font-semibold text-red-600">{errors.name.message}</p>}
            </div>
            <div>
              <label className="label">Descripción (opcional)</label>
              <textarea className="input" rows={2} {...register("description")} />
            </div>
            <div>
              <label className="label">Tipo de desafío</label>
              <select className="input" {...register("challengeType")}>
                {CHALLENGE_TYPES.map((c) => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
              <p className="mt-1 text-xs font-semibold text-forest-500">
                {CHALLENGE_TYPES.find((c) => c.value === challengeType)?.hint}
              </p>
            </div>
            <div>
              <label className="label">Consigna mostrada al escanear</label>
              <textarea className="input" rows={3} {...register("instructions")} placeholder="Instrucciones para el equipo…" />
            </div>
            <div>
              <label className="label">Contenido visible (opcional)</label>
              <input className="input" {...register("displayedCode")} placeholder="Texto/pista mostrada al escanear" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Latitud (opcional)</label>
                <input
                  className="input"
                  inputMode="decimal"
                  {...register("latitude")}
                  placeholder="-25.3056"
                />
                {errors.latitude && (
                  <p className="mt-1 text-sm font-semibold text-red-600">{errors.latitude.message}</p>
                )}
              </div>
              <div>
                <label className="label">Longitud (opcional)</label>
                <input
                  className="input"
                  inputMode="decimal"
                  {...register("longitude")}
                  placeholder="-57.2436"
                />
                {errors.longitude && (
                  <p className="mt-1 text-sm font-semibold text-red-600">{errors.longitude.message}</p>
                )}
              </div>
            </div>
            <p className="text-xs font-semibold text-forest-500">
              Coordenadas para el mapa del itinerario. Completá ambas o dejá las dos vacías.
            </p>
            {needsAnswer && (
              <div>
                <label className="label">Respuesta esperada (secreto del servidor)</label>
                <input className="input" {...register("expectedAnswer")} placeholder="La respuesta correcta" />
                {errors.expectedAnswer && <p className="mt-1 text-sm font-semibold text-red-600">{errors.expectedAnswer.message}</p>}
              </div>
            )}
            {challengeType === "AUTO" && (
              <label className="flex items-center gap-2 font-bold text-forest-800">
                <input type="checkbox" {...register("autoAcceptAny")} className="h-4 w-4 accent-clay-500" />
                Aceptar cualquier respuesta no vacía
              </label>
            )}
            <label className="flex items-center gap-2 font-bold text-forest-800">
              <input type="checkbox" {...register("active")} className="h-4 w-4 accent-forest-700" />
              Posta activa
            </label>
            <button type="submit" disabled={isSubmitting || busy} className="btn-primary w-full">
              {editing ? "Guardar cambios" : "Crear posta"}
            </button>
          </form>
        </Modal>
      )}

      {importOpen && (
        <Modal title="Importar coordenadas (CSV)" onClose={() => setImportOpen(false)}>
          <div className="space-y-4">
            {importError && <Alert tone="error">{importError}</Alert>}
            {importResult && (
              <Alert tone={importResult.errors.length > 0 ? "warning" : "success"}>
                {importResult.updated} posta(s) actualizada(s) de {importResult.parsed} fila(s).
                {importResult.errors.length > 0 && (
                  <ul className="mt-2 list-disc pl-5">
                    {importResult.errors.slice(0, 10).map((e, i) => (
                      <li key={i}>Fila {e.row}: {e.error}</li>
                    ))}
                    {importResult.errors.length > 10 && (
                      <li>…y {importResult.errors.length - 10} más.</li>
                    )}
                  </ul>
                )}
              </Alert>
            )}
            <div className="rounded-2xl bg-beige-50 p-3 text-xs font-semibold text-forest-600">
              <p className="font-bold text-forest-800">Formato esperado</p>
              <p className="mt-1 font-mono">nombre, qr_id, latitud, longitud, descripcion</p>
              <p className="mt-1">
                La primera fila puede ser el encabezado. Se emparejan las postas existentes por
                nombre o código; las filas sin coincidencia se reportan como error. No crea postas nuevas.
              </p>
            </div>
            <input
              type="file"
              accept=".csv,text/csv,text/plain"
              onChange={(e) => onCsvFile(e.target.files?.[0] ?? null)}
              className="block w-full text-sm font-semibold text-forest-700"
            />
            <textarea
              className="input font-mono text-xs"
              rows={8}
              value={csvText}
              onChange={(e) => setCsvText(e.target.value)}
              placeholder={"nombre,qr_id,latitud,longitud\nMirador,,-25.3056,-57.2436"}
            />
            <div className="flex justify-end gap-2">
              <button onClick={() => setImportOpen(false)} className="btn-secondary">Cerrar</button>
              <button
                onClick={() => void runImport()}
                disabled={importBusy || csvText.trim() === ""}
                className="btn-primary"
              >
                {importBusy ? "Importando…" : "Importar"}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {confirmDelete && (
        <ConfirmDialog
          title="Eliminar posta"
          message={`Se eliminará la posta "${confirmDelete.name}" y su itinerario asociado. ¿Continuar?`}
          confirmLabel="Eliminar"
          danger
          busy={busy}
          onConfirm={() => void doDelete()}
          onClose={() => setConfirmDelete(null)}
        />
      )}
    </div>
  );
}