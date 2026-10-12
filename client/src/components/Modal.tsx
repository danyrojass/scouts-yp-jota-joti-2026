import type { ReactNode } from "react";
import { X } from "lucide-react";

export function Modal({
  title,
  onClose,
  children,
  footer,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-forest-950/50 p-0 sm:items-center sm:p-6"
      onClick={onClose}
    >
      <div
        className="max-h-[92dvh] w-full max-w-lg animate-fade-in overflow-y-auto rounded-t-3xl bg-white p-5 shadow-lift sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="font-display text-lg font-bold text-forest-900">{title}</h2>
          <button onClick={onClose} className="rounded-xl p-2 text-forest-500 hover:bg-forest-50" aria-label="Cerrar">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div>{children}</div>
        {footer && <div className="mt-5 flex justify-end gap-2">{footer}</div>}
      </div>
    </div>
  );
}

export function ConfirmDialog({
  title,
  message,
  confirmLabel = "Confirmar",
  danger = false,
  onConfirm,
  onClose,
  busy = false,
}: {
  title: string;
  message: string;
  confirmLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onClose: () => void;
  busy?: boolean;
}) {
  return (
    <Modal title={title} onClose={onClose}>
      <p className="text-sm font-semibold text-forest-700">{message}</p>
      <div className="mt-5 flex justify-end gap-2">
        <button onClick={onClose} className="btn-secondary">
          Cancelar
        </button>
        <button
          onClick={onConfirm}
          disabled={busy}
          className={danger ? "btn-danger" : "btn-primary"}
        >
          {confirmLabel}
        </button>
      </div>
    </Modal>
  );
}