import { useCallback, useState } from "react";
import { Compass, CheckCircle2, Circle, RefreshCw } from "lucide-react";
import { api } from "@/api/client";
import { errorMessage, type TeamSafari } from "@/api/types";
import { useApi } from "@/hooks/useApi";
import { LoadingScreen } from "@/components/LoadingScreen";
import { Alert } from "@/components/Alert";
import { ProgressBar } from "@/components/ProgressBar";

export function SafariPage() {
  const fetchSafari = useCallback(() => api.get<TeamSafari>("/api/v1/safari"), []);
  const { data, loading, error, reload, setData } = useApi<TeamSafari>(fetchSafari);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const toggle = async (itemId: string, found: boolean) => {
    if (!data) return;
    setBusyId(itemId);
    setActionError(null);
    try {
      const updated = found
        ? await api.del<TeamSafari>(`/api/v1/safari/items/${itemId}/find`)
        : await api.post<TeamSafari>(`/api/v1/safari/items/${itemId}/find`);
      setData(updated);
    } catch (err) {
      setActionError(errorMessage(err));
    } finally {
      setBusyId(null);
    }
  };

  if (loading && !data) return <LoadingScreen label="Cargando safari..." />;
  if (error && !data) return <Alert tone="error">{error}</Alert>;
  if (!data) return null;

  const { safari, items, progress, event } = data;
  const inProgress = event.status === "IN_PROGRESS";

  if (!safari) {
    return (
      <div className="space-y-4">
        <section className="card text-center">
          <Compass className="mx-auto h-10 w-10 text-clay-600" />
          <h1 className="mt-2 font-display text-2xl font-bold text-forest-900">Safari de Exploración</h1>
          <p className="mt-1 text-sm font-semibold text-forest-600">
            El safari todavía no está disponible para este evento.
          </p>
        </section>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <section className="card">
        <div className="flex items-center gap-3">
          <Compass className="h-8 w-8 text-clay-600" />
          <div>
            <h1 className="font-display text-2xl font-bold text-forest-900">{safari.title}</h1>
            {safari.description && (
              <p className="text-sm font-semibold text-forest-600">{safari.description}</p>
            )}
          </div>
        </div>

        <div className="mt-4">
          <div className="mb-1.5 flex items-baseline justify-between">
            <p className="text-sm font-bold text-forest-800">
              {progress.found} de {progress.total} encontrados
            </p>
            <p className="text-sm font-extrabold text-clay-600">{progress.percent}%</p>
          </div>
          <ProgressBar value={progress.found} max={progress.total} />
        </div>

        {progress.done && (
          <div className="mt-4">
            <Alert tone="success">¡Completaron todo el Safari de Exploración!</Alert>
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

      {actionError && <Alert tone="error">{actionError}</Alert>}

      <section className="card">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="font-display text-lg font-bold text-forest-900">
            {items.length} elementos por encontrar
          </h2>
          <button
            onClick={() => void reload()}
            className="rounded-xl p-2 text-forest-600 hover:bg-forest-50"
            title="Actualizar"
          >
            <RefreshCw className="h-5 w-5" />
          </button>
        </div>

        {items.length === 0 ? (
          <p className="text-sm font-semibold text-forest-500">
            Todavía no hay elementos en el safari.
          </p>
        ) : (
          <ul className="space-y-2">
            {items.map((item) => {
              const disabled = busyId !== null || !safari.active || !inProgress;
              return (
                <li key={item.id}>
                  <button
                    onClick={() => void toggle(item.id, item.found)}
                    disabled={disabled}
                    className={`flex w-full items-start gap-3 rounded-2xl border px-3.5 py-3 text-left transition-colors disabled:opacity-70 ${
                      item.found
                        ? "border-forest-200 bg-forest-50"
                        : "border-beige-200 bg-white hover:bg-forest-50"
                    }`}
                  >
                    {item.found ? (
                      <CheckCircle2 className="mt-0.5 h-6 w-6 shrink-0 text-forest-600" />
                    ) : (
                      <Circle className="mt-0.5 h-6 w-6 shrink-0 text-beige-300" />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className={`font-bold ${item.found ? "text-forest-900 line-through" : "text-forest-900"}`}>
                        {item.name}
                      </p>
                      {item.description && (
                        <p className="text-xs font-semibold text-forest-500">{item.description}</p>
                      )}
                      {item.found && item.foundAt && (
                        <p className="mt-0.5 text-xs font-bold uppercase tracking-wide text-forest-600">
                          Encontrado
                        </p>
                      )}
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <p className="text-center text-xs text-forest-500">
        El progreso del safari se guarda en el servidor y es independiente de las postas del recorrido.
      </p>
    </div>
  );
}
