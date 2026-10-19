import { useEffect, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, Loader2, Trash2 } from 'lucide-react';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Confirmación propia del CMS. Reemplaza window.confirm para no mostrar el
 * diálogo nativo del sistema operativo.
 */
export default function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = 'Eliminar',
  cancelLabel = 'Cancelar',
  busy = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !busy) onCancel();
    };

    document.addEventListener('keydown', handleKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, busy, onCancel]);

  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center bg-gray-900/50 p-4 backdrop-blur-[2px]"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !busy) onCancel();
      }}
      role="presentation"
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-label={title}
        className="w-full max-w-md rounded-2xl border border-gray-100 bg-white p-6 shadow-2xl"
      >
        <div className="flex items-start gap-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-red-50 text-red-600">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <h3 className="text-lg font-serif text-gray-900">{title}</h3>
            {description ? (
              <div className="mt-1.5 text-sm leading-relaxed text-gray-500">{description}</div>
            ) : null}
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            autoFocus
            className="rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-200 disabled:opacity-50"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700 disabled:opacity-50"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
