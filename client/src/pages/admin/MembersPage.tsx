import { useCallback, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, Pencil, Trash2, Users, Search } from "lucide-react";
import { api } from "@/api/client";
import {
  errorMessage,
  type EventItem,
  type MemberItem,
  type MemberRole,
} from "@/api/types";
import { useApi } from "@/hooks/useApi";
import { LoadingScreen } from "@/components/LoadingScreen";
import { Alert } from "@/components/Alert";
import { Badge } from "@/components/ProgressBar";
import { Modal, ConfirmDialog } from "@/components/Modal";

type EventWithTeams = EventItem & { teams?: { id: string; name: string }[] };

const ROLE_LABEL: Record<MemberRole, string> = {
  SCOUT: "Scout",
  DIRIGENTE: "Dirigente",
  OTRO: "Otro",
};

const ROLE_TONE: Record<MemberRole, "forest" | "orange" | "beige"> = {
  SCOUT: "forest",
  DIRIGENTE: "orange",
  OTRO: "beige",
};

const memberSchema = z.object({
  firstName: z.string().trim().min(1, "El nombre es obligatorio").max(120),
  lastName: z.string().trim().min(1, "El apellido es obligatorio").max(120),
  document: z.string().trim().max(60).optional().nullable(),
  birthDate: z.string().trim().max(30).optional().nullable(),
  role: z.enum(["SCOUT", "DIRIGENTE", "OTRO"]),
  teamId: z.string().optional().nullable(),
  phone: z.string().trim().max(40).optional().nullable(),
  notes: z.string().trim().max(500).optional().nullable(),
  active: z.boolean(),
});

type FormValues = z.infer<typeof memberSchema>;

export function MembersPage() {
  const { eventId = "" } = useParams();
  const fetchEvent = useCallback(
    () => api.get<{ event: EventWithTeams }>(`/api/v1/events/${eventId}`).then((r) => r.event),
    [eventId]
  );
  const { data: event } = useApi<EventWithTeams>(fetchEvent, [eventId]);
  const fetchMembers = useCallback(
    () => api.get<{ members: MemberItem[] }>(`/api/v1/members?eventId=${eventId}`).then((r) => r.members),
    [eventId]
  );
  const { data: members, loading, error, reload } = useApi<MemberItem[]>(fetchMembers, [eventId]);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<MemberItem | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<MemberItem | null>(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
  } = useForm<FormValues>({ resolver: zodResolver(memberSchema) });

  const teams = event?.teams ?? [];

  const filtered = useMemo(() => {
    const list = members ?? [];
    const q = query.trim().toLowerCase();
    if (!q) return list;
    return list.filter((m) =>
      `${m.firstName} ${m.lastName} ${m.document ?? ""}`.toLowerCase().includes(q)
    );
  }, [members, query]);

  const openCreate = () => {
    setEditing(null);
    reset({
      firstName: "",
      lastName: "",
      document: "",
      birthDate: "",
      role: "SCOUT",
      teamId: "",
      phone: "",
      notes: "",
      active: true,
    });
    setActionError(null);
    setFormOpen(true);
  };

  const openEdit = (m: MemberItem) => {
    setEditing(m);
    reset({
      firstName: m.firstName,
      lastName: m.lastName,
      document: m.document ?? "",
      birthDate: m.birthDate ? m.birthDate.slice(0, 10) : "",
      role: m.role,
      teamId: m.teamId ?? "",
      phone: m.phone ?? "",
      notes: m.notes ?? "",
      active: m.active,
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
        teamId: values.teamId && values.teamId !== "" ? values.teamId : null,
      };
      if (editing) {
        await api.patch(`/api/v1/members/${editing.id}`, payload);
      } else {
        await api.post("/api/v1/members", { ...payload, eventId });
      }
      setFormOpen(false);
      await reload();
    } catch (err) {
      setActionError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const doDelete = async () => {
    if (!confirmDelete) return;
    setBusy(true);
    try {
      await api.del(`/api/v1/members/${confirmDelete.id}`);
      setConfirmDelete(null);
      await reload();
    } catch (err) {
      setActionError(errorMessage(err));
      setConfirmDelete(null);
    } finally {
      setBusy(false);
    }
  };

  if (loading && !members) return <LoadingScreen label="Cargando integrantes…" />;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-bold text-forest-900">Integrantes</h2>
          <p className="text-sm font-semibold text-forest-600">
            Lista de beneficiarios del evento. No tienen cuenta ni inicio de sesión.
          </p>
        </div>
        <button onClick={openCreate} className="btn-primary">
          <Plus className="h-5 w-5" /> Nuevo integrante
        </button>
      </div>

      {error && !members && <Alert tone="error">{error}</Alert>}
      {actionError && <Alert tone="error">{actionError}</Alert>}

      <div className="card flex items-start gap-3 text-sm">
        <Users className="mt-0.5 h-5 w-5 shrink-0 text-clay-600" />
        <p className="font-semibold text-forest-600">
          Los integrantes son solo datos administrativos. Podés asignarlos a un equipo o dejarlos
          sin asignar. El documento es único por evento.
        </p>
      </div>

      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-forest-400" />
        <input
          className="input pl-9"
          placeholder="Buscar por nombre o documento…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      {filtered.length === 0 ? (
        <div className="card text-center">
          <p className="font-bold text-forest-700">
            {members && members.length > 0 ? "Sin resultados." : "Todavía no hay integrantes."}
          </p>
          <p className="text-sm font-semibold text-forest-500">
            {members && members.length > 0
              ? "Probá con otra búsqueda."
              : "Agregá el primero con el botón «Nuevo integrante»."}
          </p>
        </div>
      ) : (
        <section className="card overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-beige-200 text-left text-xs font-bold uppercase tracking-wide text-forest-500">
                <th className="py-2 pr-3">Nombre</th>
                <th className="py-2 pr-3">Documento</th>
                <th className="py-2 pr-3">Rol</th>
                <th className="py-2 pr-3">Equipo</th>
                <th className="py-2 pr-3">Estado</th>
                <th className="py-2 pr-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((m) => (
                <tr key={m.id} className="border-b border-beige-100 last:border-0 hover:bg-forest-50/50">
                  <td className="py-2.5 pr-3 font-bold text-forest-900">
                    {m.lastName}, {m.firstName}
                  </td>
                  <td className="py-2.5 pr-3 font-semibold text-forest-600">{m.document ?? "—"}</td>
                  <td className="py-2.5 pr-3">
                    <Badge tone={ROLE_TONE[m.role]}>{ROLE_LABEL[m.role]}</Badge>
                  </td>
                  <td className="py-2.5 pr-3 font-semibold text-forest-600">
                    {m.team?.name ?? "Sin asignar"}
                  </td>
                  <td className="py-2.5 pr-3">
                    {m.active ? <Badge tone="green">Activo</Badge> : <Badge tone="red">Inactivo</Badge>}
                  </td>
                  <td className="py-2.5 pr-3">
                    <div className="flex justify-end gap-1.5">
                      <button
                        onClick={() => openEdit(m)}
                        className="rounded-xl p-2 text-forest-600 hover:bg-forest-50"
                        title="Editar"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => setConfirmDelete(m)}
                        className="rounded-xl p-2 text-red-600 hover:bg-red-50"
                        title="Eliminar"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {formOpen && (
        <Modal
          title={editing ? `Editar integrante: ${editing.firstName} ${editing.lastName}` : "Nuevo integrante"}
          onClose={() => setFormOpen(false)}
        >
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
            {actionError && <Alert tone="error">{actionError}</Alert>}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Nombre</label>
                <input className="input" {...register("firstName")} placeholder="Ana" />
                {errors.firstName && (
                  <p className="mt-1 text-sm font-semibold text-red-600">{errors.firstName.message}</p>
                )}
              </div>
              <div>
                <label className="label">Apellido</label>
                <input className="input" {...register("lastName")} placeholder="Pérez" />
                {errors.lastName && (
                  <p className="mt-1 text-sm font-semibold text-red-600">{errors.lastName.message}</p>
                )}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Documento (opcional)</label>
                <input className="input" {...register("document")} placeholder="Cédula / CI" />
              </div>
              <div>
                <label className="label">Fecha de nacimiento (opcional)</label>
                <input type="date" className="input" {...register("birthDate")} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Rol</label>
                <select className="input" {...register("role")}>
                  <option value="SCOUT">Scout</option>
                  <option value="DIRIGENTE">Dirigente</option>
                  <option value="OTRO">Otro</option>
                </select>
              </div>
              <div>
                <label className="label">Equipo (opcional)</label>
                <select className="input" {...register("teamId")}>
                  <option value="">Sin asignar</option>
                  {teams.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label className="label">Teléfono (opcional)</label>
              <input className="input" {...register("phone")} placeholder="0981 000 000" />
            </div>
            <div>
              <label className="label">Notas (opcional)</label>
              <textarea className="input" rows={2} {...register("notes")} />
            </div>
            <label className="flex items-center gap-2 font-bold text-forest-800">
              <input type="checkbox" {...register("active")} className="h-4 w-4 accent-forest-700" />
              Integrante activo
            </label>
            <button type="submit" disabled={isSubmitting || busy} className="btn-primary w-full">
              {editing ? "Guardar cambios" : "Agregar integrante"}
            </button>
          </form>
        </Modal>
      )}

      {confirmDelete && (
        <ConfirmDialog
          title="Eliminar integrante"
          message={`Se eliminará a "${confirmDelete.firstName} ${confirmDelete.lastName}" de la lista del evento. ¿Continuar?`}
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
