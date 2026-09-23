'use client';

import { AlertTriangle } from 'lucide-react';

export type PanelConfirmRequest = {
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
};

export function PanelConfirmDialog({
  open,
  title = 'Onay',
  message,
  confirmLabel,
  cancelLabel = 'İptal',
  danger = true,
  onConfirm,
  onCancel,
}: PanelConfirmRequest & {
  open: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (!open) return null;
  const actionLabel = confirmLabel ?? (danger ? 'Evet' : 'Tamam');

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4">
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="panel-confirm-title"
        className="flex max-h-[100dvh] w-full max-w-sm flex-col overflow-hidden rounded-t-2xl bg-white shadow-xl sm:max-h-[calc(100dvh-2rem)] sm:rounded-2xl"
      >
        <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
          <div className="mb-4 flex items-center gap-3">
            {danger ? (
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-red-50">
                <AlertTriangle className="h-5 w-5 text-status-danger" strokeWidth={1.75} />
              </div>
            ) : null}
            <h3 id="panel-confirm-title" className="text-base font-semibold text-slate-800">
              {title}
            </h3>
          </div>
          <p className="whitespace-pre-wrap text-sm leading-6 text-slate-600">{message}</p>
        </div>
        <div className="flex shrink-0 gap-3 border-t border-slate-100 px-4 py-4 sm:px-6 sm:pb-6">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 rounded-lg border border-slate-200 py-2 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-50"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`flex-1 rounded-lg py-2 text-sm font-semibold text-white transition-colors ${
              danger ? 'bg-red-600 hover:bg-red-700' : 'bg-brand-600 hover:bg-brand-700'
            }`}
          >
            {actionLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
