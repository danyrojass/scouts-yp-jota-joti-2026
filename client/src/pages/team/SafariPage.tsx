import { useCallback, useState } from "react";
import {
  Compass,
  CheckCircle2,
  Circle,
  RefreshCw,
  Camera,
  MessageCircle,
  ShieldCheck,
} from "lucide-react";
import { api } from "@/api/client";
import {
  errorMessage,
  type SafariCategory,
  type SafariItemType,
  type TeamSafari,
} from "@/api/types";
import { useApi } from "@/hooks/useApi";
import { LoadingScreen } from "@/components/LoadingScreen";
import { Alert } from "@/components/Alert";
import { ProgressBar, Badge } from "@/components/ProgressBar";

const CATEGORY_LABELS: Record<SafariCategory, string> = {
  LUGARES_CULTURA: "Lugares y cultura de Ypacaraí",
  NATURALEZA: "Naturaleza",
  OBJETOS_CURIOSIDADES: "Objetos y curiosidades",
  DESAFIOS_FOTOGRAFICOS: "Desafíos fotográficos",
  PREGUNTAS_YPACARAI: "Preguntas sobre Ypacaraí",
  GENERAL: "General",
};

const CATEGORY_ORDER: SafariCategory[] = [
  "LUGARES_CULTURA",
  "NATURALEZA",
  "OBJETOS_CURIOSIDADES",
  "DESAFIOS_FOTOGRAFICOS",
  "PREGUNTAS_YPACARAI",
];

const TYPE_LABELS: Record<SafariItemType, string> = {
  PHOTO: "Fotografía",
  OBJECT: "Objeto",
  NUMERIC: "Observación",
  COLLECTION: "Recolección",
  QUESTION: "Pregunta",
};

const WHATSAPP_GROUP_URL = "https://chat.whatsapp.com/C0vmzEN33swAGVejxobdLP";

const SAFETY_RULES = [
  "No dañar plantas ni árboles para obtener hojas: usá solo hojas caídas.",
  "No tocar ni capturar animales.",
  "No recoger objetos peligrosos.",
  "No encender fósforos.",
  "No entrar en propiedades privadas.",
  "Pedir permiso antes de fotografiar a otras personas.",
  "Respetar las indicaciones de los organizadores.",
  "No publicar fotografías de personas sin su consentimiento.",
];

export function SafariPage() {
  const fetchSafari = useCallback(() => api.get<TeamSafari>("/api/v1/safari"), []);
  const { data, loading, error, reload, setData } = useApi<TeamSafari>(fetchSafari);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  const runAction = async (fn: () => Promise<TeamSafari>, itemId: string) => {
    setBusyId(itemId);
    setActionError(null);
    try {
      setData(await fn());
    } catch (err) {
      setActionError(errorMessage(err));
    } finally {
      setBusyId(null);
    }
  };

  const markFound = (itemId: string) =>
    runAction(() => api.post<TeamSafari>(`/api/v1/safari/items/${itemId}/find`), itemId);

  const markWithValue = (itemId: string, value: string) => {
    if (!value.trim()) return;
    runAction(
      () => api.post<TeamSafari>(`/api/v1/safari/items/${itemId}/find`, { value: value.trim() }),
      itemId
    );
  };

  const unmark = (itemId: string) =>
    runAction(() => api.del<TeamSafari>(`/api/v1/safari/items/${itemId}/find`), itemId);

  const togglePhoto = (itemId: string, ready: boolean) =>
    runAction(
      () => api.post<TeamSafari>(`/api/v1/safari/items/${itemId}/photo`, { ready }),
      itemId
    );

  if (loading && !data) return <LoadingScreen label="Cargando safari..." />;
  if (error && !data) return <Alert tone="error">{error}</Alert>;
  if (!data) return null;

  const { safari, items, categories, progress, event } = data;
  const inProgress = event.status === "IN_PROGRESS";

  if (!safari) {
    return (
      <div className="space-y-4">
        <section className="card text-center">
          <Compass className="mx-auto h-10 w-10 text-clay-600" />
          <h1 className="mt-2 font-display text-2xl font-bold text-forest-900">
            Safari JOTA JOTI 2026 — Ypacaraí
          </h1>
          <p className="mt-1 text-sm font-semibold text-forest-600">
            El safari todavía no está disponible para este evento.
          </p>
        </section>
      </div>
    );
  }

  const grouped = CATEGORY_ORDER.map((category) => ({
    category,
    label: CATEGORY_LABELS[category],
    items: items.filter((i) => i.category === category),
  })).filter((g) => g.items.length > 0);

  const disabled = busyId !== null || !safari.active || !inProgress;

  return (
    <div className="space-y-4">
      <section className="card">
        <div className="flex items-start gap-3">
          <Compass className="h-8 w-8 shrink-0 text-clay-600" />
          <div>
            <h1 className="font-display text-2xl font-bold text-forest-900">{safari.title}</h1>
            {safari.description && (
              <p className="mt-1 text-sm font-semibold text-forest-600">{safari.description}</p>
            )}
          </div>
        </div>

        <div className="mt-4">
          <div className="mb-1.5 flex items-baseline justify-between">
            <p className="text-sm font-bold text-forest-800">
              {progress.found} de {progress.total} completados
            </p>
            <p className="text-sm font-extrabold text-clay-600">{progress.percent}%</p>
          </div>
          <ProgressBar value={progress.found} max={progress.total} />
          <p className="mt-1.5 text-xs font-bold text-forest-500">
            {progress.pending} pendientes
          </p>
        </div>

        {categories.length > 0 && (
          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {categories.map((c) => (
              <div key={c.category} className="rounded-2xl bg-beige-50 px-3 py-2">
                <p className="truncate text-[11px] font-bold uppercase tracking-wide text-forest-500">
                  {CATEGORY_LABELS[c.category]}
                </p>
                <p className="text-lg font-extrabold text-forest-900">
                  {c.found}/{c.total}
                </p>
              </div>
            ))}
          </div>
        )}

        {!safari.active && (
          <div className="mt-4">
            <Alert tone="warning">El safari está desactivado por la organización.</Alert>
          </div>
        )}
        {safari.active && !inProgress && (
          <div className="mt-4">
            <Alert tone="info">
              Podés revisar la lista, pero solo se puede marcar durante el evento en curso.
            </Alert>
          </div>
        )}
      </section>

      <section className="card">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-forest-600" />
          <h2 className="font-display text-base font-bold text-forest-900">
            Seguridad y respeto del entorno
          </h2>
        </div>
        <ul className="mt-3 space-y-1.5">
          {SAFETY_RULES.map((rule) => (
            <li key={rule} className="flex items-start gap-2 text-sm font-semibold text-forest-700">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-clay-500" />
              {rule}
            </li>
          ))}
        </ul>
      </section>

      {actionError && <Alert tone="error">{actionError}</Alert>}

      {grouped.map((group) => (
        <section key={group.category} className="card">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="font-display text-lg font-bold text-forest-900">{group.label}</h2>
            <Badge tone="beige">
              {group.items.filter((i) => i.found).length}/{group.items.length}
            </Badge>
          </div>

          <ul className="space-y-2">
            {group.items.map((item) => {
              const itemBusy = busyId === item.id;
              const answerDraft = drafts[item.id] ?? "";
              const needsAnswer = item.itemType === "NUMERIC" || item.itemType === "QUESTION";
              return (
                <li
                  key={item.id}
                  className={`rounded-2xl border px-3.5 py-3 ${
                    item.found ? "border-forest-200 bg-forest-50" : "border-beige-200 bg-white"
                  }`}
                >
                  <div className="flex w-full items-start gap-3 text-left">
                    <button
                      onClick={() => void (item.found ? unmark(item.id) : markFound(item.id))}
                      disabled={disabled || (needsAnswer && !item.found)}
                      className="mt-0.5 shrink-0 disabled:opacity-50"
                      aria-label={item.found ? "Desmarcar" : "Marcar"}
                    >
                      {item.found ? (
                        <CheckCircle2 className="h-6 w-6 text-forest-600" />
                      ) : (
                        <Circle
                          className={`h-6 w-6 ${itemBusy ? "animate-pulse" : ""} text-beige-300`}
                        />
                      )}
                    </button>
                    <div className="min-w-0 flex-1">
                      <p
                        className={`font-bold ${
                          item.found ? "text-forest-900 line-through" : "text-forest-900"
                        }`}
                      >
                        {item.name}
                      </p>
                      {item.description && (
                        <p className="text-xs font-semibold text-forest-500">{item.description}</p>
                      )}
                      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                        {item.itemType !== "PHOTO" && (
                          <Badge tone="gray">{TYPE_LABELS[item.itemType]}</Badge>
                        )}
                        {item.requiresPhoto && (
                          <Badge tone={item.photoReady ? "green" : "orange"}>
                            {item.photoReady ? "Foto lista" : "Requiere foto"}
                          </Badge>
                        )}
                        {item.found && item.value && (
                          <Badge tone="forest">Registro: {item.value}</Badge>
                        )}
                      </div>
                    </div>
                  </div>

                  {needsAnswer && !item.found && (
                    <div className="mt-3 flex items-center gap-2">
                      <input
                        type={item.itemType === "NUMERIC" ? "number" : "text"}
                        inputMode={item.itemType === "NUMERIC" ? "numeric" : "text"}
                        className="input min-w-0 flex-1"
                        placeholder={item.itemType === "NUMERIC" ? "Cantidad" : "Escribí tu respuesta"}
                        value={answerDraft}
                        onChange={(e) =>
                          setDrafts((d) => ({ ...d, [item.id]: e.target.value }))
                        }
                      />
                      <button
                        onClick={() => void markWithValue(item.id, answerDraft)}
                        disabled={disabled || !answerDraft.trim()}
                        className="btn-primary px-4 py-2 text-sm"
                      >
                        Registrar
                      </button>
                    </div>
                  )}

                  {item.found && item.requiresPhoto && (
                    <button
                      onClick={() => void togglePhoto(item.id, !item.photoReady)}
                      disabled={disabled}
                      className={`mt-2 inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-bold transition-colors ${
                        item.photoReady
                          ? "border-forest-300 bg-forest-100 text-forest-800"
                          : "border-clay-300 bg-white text-clay-700 hover:bg-clay-50"
                      }`}
                    >
                      <Camera className="h-4 w-4" />
                      {item.photoReady
                        ? "Evidencia compartida según las reglas"
                        : "Marcar foto como lista"}
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      ))}

      <section className="card overflow-hidden">
        <div className="flex items-center gap-2">
          <MessageCircle className="h-6 w-6 text-green-600" />
          <h2 className="font-display text-lg font-bold text-forest-900">
            ¿Terminaste el safari? ¡Compartí tus fotos!
          </h2>
        </div>
        <p className="mt-2 text-sm font-semibold text-forest-600">
          Cuando completen el safari, compartan las fotografías de sus desafíos en el grupo
          oficial de WhatsApp del Safari JOTA JOTI 2026 de Ypacaraí. Revisen que las imágenes
          correspondan a los desafíos de la lista y que todos los integrantes del equipo estén
          de acuerdo con compartirlas.
        </p>
        <a
          href={WHATSAPP_GROUP_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="btn-primary mt-4 w-full sm:w-auto"
        >
          <MessageCircle className="h-5 w-5" /> Compartir fotos en WhatsApp
        </a>
        <p className="mt-3 text-xs font-semibold text-forest-500">
          El enlace permite ingresar al grupo de WhatsApp, pero las fotografías deben enviarse
          manualmente desde WhatsApp: la aplicación web no puede subirlas al grupo.
        </p>
      </section>

      {progress.done && (
        <Alert tone="success">
          ¡Completaron todo el Safari de Exploración! No olviden compartir sus fotos en el grupo
          de WhatsApp oficial.
        </Alert>
      )}

      <p className="text-center text-xs text-forest-500">
        El progreso del safari se guarda en el servidor y es independiente de las postas del recorrido.
      </p>

      <div className="flex justify-center">
        <button onClick={() => void reload()} className="btn-secondary px-4 py-2 text-sm">
          <RefreshCw className="h-4 w-4" /> Actualizar
        </button>
      </div>
    </div>
  );
}