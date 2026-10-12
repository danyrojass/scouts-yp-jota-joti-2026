import { useCallback, useState } from "react";
import { useParams } from "react-router-dom";
import { Compass, Plus, Pencil, Trash2, ArrowUp, ArrowDown, RotateCcw } from "lucide-react";
import { api } from "@/api/client";
import {
  errorMessage,
  type AdminSafari,
  type AdminSafariItem,
  type SafariProgressReport,
} from "@/api/types";
import { useApi } from "@/hooks/useApi";
import { LoadingScreen } from "@/components/LoadingScreen";
import { Alert } from "@/components/Alert";
import { ProgressBar, Badge } from "@/components/ProgressBar";
import { Modal, ConfirmDialog } from "@/components/Modal";

type ItemFormValues = { name: string; description: string; active: boolean };

const EMPTY_ITEM: ItemFormValues = { name: "", description: "", active: true };

function ItemFormModal({
  title,
  initial,
  busy,
  onSave,
  onClose,
}: {
  title: string;
  initial: ItemFormValues;
  busy: boolean;
  onSave: (values: ItemFormValues) => void;
  onClose: () => void;
}) {
  const [values, setValues] = useState<ItemFormValues>(initial);
  return (
    <Modal title={title} onClose={onClose}>
      <div className="space-y-4">
        <div>
          <label className="label">Nombre</label>
          <input
            className="input"
            value={values.name}
            onChange={(e) => setValues({ ...values, name: e.target.value })}
            placeholder="Huella de animal"
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
        <label className="flex items-center gap-2 font-bold text-forest-800">
          <input
            type="checkbox"
            checked={values.active}
            onChange={(e) => setValues({ ...values, active: e.target.checked })}
            className="h-4 w-4 accent-forest-700"
          />
          Elemento activo
        </label>
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="btn-secondary">Cancelar</button>
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

function SettingsModal({
  safari,
  busy,
  onSave,
  onClose,
}: {
  safari: AdminSafari;
  busy: boolean;
  onSave: (values: { title: string; description: string; active: boolean }) => void;
  onClose: () => void;
}) {
  const [values, setValues] = useState({
    title: safari.title,
    description: safari.description ?? "",
    active: safari.active,
  });
  return (
    <Modal title="Ajustes del safari" onClose={onClose}>
      <div className="space-y-4">
        <div>
          <label className="label">Título</label>
          <input
            className="input"
            value={values.title}
            onChange={(e) => setValues({ ...values, title: e.target.value })}
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
        <label className="flex items-center gap-2 font-bold text-forest-800">
          <input
            type="checkbox"
            checked={values.active}
            onChange={(e) => setValues({ ...values, active: e.target.checked })}
            className="h-4 w-4 accent-forest-700"
          />
          Safari activo
        </label>
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="btn-secondary">Cancelar</button>
          <button
            onClick={() => onSave(values)}
            disabled={busy || values.title.trim().length < 2}
            className="btn-primary"
          >
            Guardar
          </button>
        </div>
      </div>
    </Modal>
  );
}

export function SafariAdminPage() {
  const { eventId = "" } = useParams();

  const fetchSafari = useCallback(
    () =>
      api
        .get<{ safari: AdminSafari | null }>(`/api/v1/admin/safari?eventId=${eventId}`)
        .then((r) => r.safari),
    [eventId]
  );
  const { data: safari, loading, error, reload } = useApi<AdminSafari | null>(
    fetchSafari,
    [eventId]
  );

  const safariId = safari?.id ?? null;
  const fetchProgress = useCallback(
    () =>
      safariId
        ? api.get<SafariProgressReport>(`/api/v1/admin/safari/${safariId}/progress`)
        : Promise.resolve(null),
    [safariId]
  );
  const { data: progress, reload: reloadProgress } = useApi<SafariProgressReport | null>(
    fetchProgress,
    [safariId]
  );

  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [itemModal, setItemModal] = useState<{ item: AdminSafariItem | null } | null>(null);
  const [confirmDeleteItem, setConfirmDeleteItem] = useState<AdminSafariItem | null>(null);
  const [confirmResetTeam, setConfirmResetTeam] = useState<{ id: string; name: string } | null>(null);
  const [confirmResetAll, setConfirmResetAll] = useState(false);

  const run = async (fn: () => Promise<unknown>, after?: () => Promise<unknown>) => {
    setBusy(true);
    setActionError(null);
    try {
      await fn();
      await reload();
      if (after) await after();
    } catch (err) {
      setActionError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const createSafari = () =>
    run(() =>
      api.post("/api/v1/admin/safari", {
        eventId,
        title: "Safari de Exploración",
      })
    );

  const saveSafari = (values: { title: string; description: string; active: boolean }) =>
    run(() =>
      api.patch(`/api/v1/admin/safari/${safariId}`, {
        title: values.title,
        description: values.description || null,
        active: values.active,
      })
    ).then(() => setSettingsOpen(false));

  const saveItem = (values: ItemFormValues) => {
    const editing = itemModal?.item ?? null;
    const body = {
      name: values.name,
      description: values.description || null,
      active: values.active,
    };
    return run(() =>
      editing
        ? api.patch(`/api/v1/admin/safari/items/${editing.id}`, body)
        : api.post(`/api/v1/admin/safari/${safariId}/items`, body)
    ).then(() => setItemModal(null));
  };

  const deleteItem = () => {
    if (!confirmDeleteItem) return;
    void run(() => api.del(`/api/v1/admin/safari/items/${confirmDeleteItem.id}`)).then(() =>
      setConfirmDeleteItem(null)
    );
  };

  const move = (index: number, dir: -1 | 1) => {
    if (!safari) return;
    const items = [...safari.items].sort((a, b) => a.position - b.position);
    const target = index + dir;
    if (target < 0 || target >= items.length) return;
    [items[index], items[target]] = [items[target], items[index]];
    void run(() =>
      api.post(`/api/v1/admin/safari/${safariId}/reorder`, {
        itemIds: items.map((i) => i.id),
      })
    );
  };

  const resetProgress = (teamId?: string) =>
    run(
      () => api.post("/api/v1/admin/safari/reset", teamId ? { eventId, teamId } : { eventId }),
      reloadProgress
    );

  if (loading && safari === null && !error) {
    return <LoadingScreen label="Cargando safari..." />;
  }
  if (error && safari === null) return <Alert tone="error">{error}</Alert>;

  if (!safari) {
    return (
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-xl font-bold text-forest-900">Safari de Exploración</h2>
            <p className="text-sm font-semibold text-forest-600">
              Checklist colaborativo que los equipos completan durante el evento.
            </p>
          </div>
        </div>
        {actionError && <Alert tone="error">{actionError}</Alert>}
        <div className="card text-center">
          <Compass className="mx-auto h-10 w-10 text-clay-600" />
          <p className="mt-2 font-bold text-forest-700">Este evento todavía no tiene un safari.</p>
          <button onClick={() => void createSafari()} disabled={busy} className="btn-primary mx-auto mt-4">
            <Plus className="h-5 w-5" /> Crear safari
          </button>
        </div>
      </div>
    );
  }

  const items = [...safari.items].sort((a, b) => a.position - b.position);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-bold text-forest-900">Safari de Exploración</h2>
          <p className="text-sm font-semibold text-forest-600">
            Configurá la lista de elementos y seguí el progreso de cada equipo.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setSettingsOpen(true)} className="btn-secondary">
            <Pencil className="h-5 w-5" /> Ajustes
          </button>
          <button onClick={() => setItemModal({ item: null })} className="btn-primary">
            <Plus className="h-5 w-5" /> Nuevo elemento
          </button>
        </div>
      </div>

      {actionError && <Alert tone="error">{actionError}</Alert>}
      {!safari.active && (
        <Alert tone="warning">El safari está desactivado: los equipos no pueden marcar elementos.</Alert>
      )}

      <section className="card">
        <h3 className="mb-3 font-display text-lg font-bold text-forest-900">
          Elementos ({items.length})
        </h3>
        {items.length === 0 ? (
          <p className="text-sm font-semibold text-forest-500">Agregá el primer elemento del safari.</p>
        ) : (
          <ul className="space-y-2">
            {items.map((item, i) => (
              <li
                key={item.id}
                className="flex items-center gap-2 rounded-2xl border border-beige-200 bg-beige-50 px-3 py-2"
              >
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-forest-700 text-xs font-extrabold text-white">
                  {i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-bold text-forest-900">{item.name}</p>
                  {item.description && (
                    <p className="truncate text-xs font-semibold text-forest-500">{item.description}</p>
                  )}
                </div>
                {!item.active && <Badge tone="red">Inactivo</Badge>}
                <button onClick={() => move(i, -1)} disabled={i === 0 || busy} className="rounded-lg p-1.5 text-forest-600 hover:bg-forest-100 disabled:opacity-30">
                  <ArrowUp className="h-4 w-4" />
                </button>
                <button onClick={() => move(i, 1)} disabled={i === items.length - 1 || busy} className="rounded-lg p-1.5 text-forest-600 hover:bg-forest-100 disabled:opacity-30">
                  <ArrowDown className="h-4 w-4" />
                </button>
                <button onClick={() => setItemModal({ item })} className="rounded-lg p-1.5 text-forest-600 hover:bg-forest-100">
                  <Pencil className="h-4 w-4" />
                </button>
                <button onClick={() => setConfirmDeleteItem(item)} className="rounded-lg p-1.5 text-red-500 hover:bg-red-50">
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h3 className="font-display text-lg font-bold text-forest-900">Progreso por equipo</h3>
          <button
            onClick={() => setConfirmResetAll(true)}
            disabled={busy || (progress?.counts.teams ?? 0) === 0}
            className="btn-secondary px-3 py-2 text-sm"
          >
            <RotateCcw className="h-4 w-4" /> Reiniciar todo
          </button>
        </div>

        {progress && (
          <div className="mb-4 grid grid-cols-3 gap-3 text-center">
            <div className="rounded-2xl bg-beige-50 p-3">
              <p className="text-2xl font-extrabold text-forest-900">{progress.counts.activeItems}</p>
              <p className="text-xs font-bold text-forest-600">Elementos activos</p>
            </div>
            <div className="rounded-2xl bg-beige-50 p-3">
              <p className="text-2xl font-extrabold text-forest-900">{progress.counts.teams}</p>
              <p className="text-xs font-bold text-forest-600">Equipos</p>
            </div>
            <div className="rounded-2xl bg-beige-50 p-3">
              <p className="text-2xl font-extrabold text-forest-900">{progress.counts.teamsCompleted}</p>
              <p className="text-xs font-bold text-forest-600">Completaron</p>
            </div>
          </div>
        )}

        {progress && progress.teams.length > 0 ? (
          <ul className="space-y-3">
            {progress.teams.map((t) => (
              <li key={t.teamId} className="rounded-2xl border border-beige-200 px-3 py-2.5">
                <div className="mb-1.5 flex items-center justify-between gap-2">
                  <p className="font-bold text-forest-900">{t.team}</p>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-forest-600">
                      {t.found}/{t.total} · {t.percent}%
                    </span>
                    <button
                      onClick={() => setConfirmResetTeam({ id: t.teamId, name: t.team })}
                      disabled={busy}
                      className="rounded-lg p-1.5 text-forest-500 hover:bg-forest-50"
                      title="Reiniciar progreso del equipo"
                    >
                      <RotateCcw className="h-4 w-4" />
                    </button>
                  </div>
                </div>
                <ProgressBar value={t.found} max={t.total} />
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm font-semibold text-forest-500">Sin equipos para mostrar.</p>
        )}

        {progress && progress.items.length > 0 && (
          <div className="mt-5">
            <h4 className="mb-2 text-xs font-bold uppercase tracking-wide text-forest-500">
              Elementos más encontrados
            </h4>
            <ul className="divide-y divide-beige-200">
              {progress.items.slice(0, 5).map((item) => (
                <li key={item.id} className="flex items-center justify-between gap-2 py-2 text-sm">
                  <span className="min-w-0 truncate font-bold text-forest-900">{item.name}</span>
                  <span className="shrink-0 text-xs font-bold text-forest-600">{item.teams} equipos</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      {settingsOpen && (
        <SettingsModal
          safari={safari}
          busy={busy}
          onSave={saveSafari}
          onClose={() => setSettingsOpen(false)}
        />
      )}

      {itemModal && (
        <ItemFormModal
          title={itemModal.item ? "Editar elemento" : "Nuevo elemento"}
          initial={
            itemModal.item
              ? {
                  name: itemModal.item.name,
                  description: itemModal.item.description ?? "",
                  active: itemModal.item.active,
                }
              : EMPTY_ITEM
          }
          busy={busy}
          onSave={saveItem}
          onClose={() => setItemModal(null)}
        />
      )}

      {confirmDeleteItem && (
        <ConfirmDialog
          title="Eliminar elemento"
          message={`Se eliminará "${confirmDeleteItem.name}" y su progreso asociado. ¿Continuar?`}
          confirmLabel="Eliminar"
          danger
          busy={busy}
          onConfirm={deleteItem}
          onClose={() => setConfirmDeleteItem(null)}
        />
      )}

      {confirmResetTeam && (
        <ConfirmDialog
          title="Reiniciar progreso"
          message={`Se borrará el progreso del safari del equipo "${confirmResetTeam.name}". ¿Continuar?`}
          confirmLabel="Reiniciar"
          danger
          busy={busy}
          onConfirm={() => {
            void resetProgress(confirmResetTeam.id).then(() => setConfirmResetTeam(null));
          }}
          onClose={() => setConfirmResetTeam(null)}
        />
      )}

      {confirmResetAll && (
        <ConfirmDialog
          title="Reiniciar todo"
          message="Se borrará el progreso del safari de TODOS los equipos. ¿Continuar?"
          confirmLabel="Reiniciar todo"
          danger
          busy={busy}
          onConfirm={() => {
            void resetProgress().then(() => setConfirmResetAll(false));
          }}
          onClose={() => setConfirmResetAll(false)}
        />
      )}
    </div>
  );
}
