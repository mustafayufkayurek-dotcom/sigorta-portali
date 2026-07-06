'use client';

import React from 'react';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  onSave?: () => void;
  saving?: boolean;
  saveLabel?: string;
  children: React.ReactNode;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl';
  error?: string;
}

const maxWidthCls = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-xl',
};

export function SettingsModal({
  isOpen,
  onClose,
  title,
  onSave,
  saving,
  saveLabel = 'Kaydet',
  children,
  maxWidth = 'md',
  error,
}: SettingsModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4">
      <div
        className={`flex max-h-[100dvh] w-full flex-col overflow-hidden rounded-t-2xl bg-white shadow-xl sm:max-h-[calc(100dvh-2rem)] sm:rounded-2xl ${maxWidthCls[maxWidth]}`}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-4 py-4 sm:border-0 sm:px-6 sm:pt-6 sm:pb-0">
          <h3 className="text-base font-semibold text-slate-800">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4 sm:px-6">{children}</div>

        {error && (
          <p className="mx-4 mb-0 shrink-0 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 sm:mx-6">{error}</p>
        )}

        {onSave && (
          <div className="flex shrink-0 gap-3 border-t border-slate-100 px-4 py-4 sm:border-0 sm:px-6 sm:pb-6 sm:pt-5">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-lg border border-slate-200 py-2 text-sm text-slate-600 hover:bg-slate-50 transition-colors"
            >
              İptal
            </button>
            <button
              type="button"
              onClick={onSave}
              disabled={saving}
              className="flex-1 rounded-lg bg-blue-600 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {saving ? 'Kaydediliyor...' : saveLabel}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Delete Confirm Dialog ──────────────────────────────────────────────────────

interface DeleteConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  deleting?: boolean;
  itemName?: string;
  title?: string;
  description?: string;
  error?: string;
}

export function DeleteConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  deleting,
  itemName,
  title = 'Kaydı Sil',
  description,
  error,
}: DeleteConfirmDialogProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4">
      <div className="flex max-h-[100dvh] w-full max-w-sm flex-col overflow-hidden rounded-t-2xl bg-white shadow-xl sm:max-h-[calc(100dvh-2rem)] sm:rounded-2xl">
        <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-red-50">
              <svg className="h-5 w-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h3 className="text-base font-semibold text-slate-800">{title}</h3>
          </div>
          <p className="text-sm text-slate-500">
            {description ?? (
              <>
                {itemName && (
                  <span className="font-medium text-slate-700">&ldquo;{itemName}&rdquo;</span>
                )}{' '}
                kaydını silmek istediğinize emin misiniz? Bu işlem geri alınamaz.
              </>
            )}
          </p>
          {error && (
            <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
          )}
        </div>
        <div className="flex shrink-0 gap-3 border-t border-slate-100 px-4 py-4 sm:px-6 sm:pb-6">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-lg border border-slate-200 py-2 text-sm text-slate-600 transition-colors hover:bg-slate-50"
          >
            İptal
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={deleting}
            className="flex-1 rounded-lg bg-red-600 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700 disabled:opacity-50"
          >
            {deleting ? 'Siliniyor...' : 'Evet, Sil'}
          </button>
        </div>
      </div>
    </div>
  );
}
