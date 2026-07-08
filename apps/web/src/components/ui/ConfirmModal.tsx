'use client';

import { ReactNode } from 'react';

interface ConfirmModalProps {
  open: boolean;
  title: string;
  message: string | ReactNode;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'warning' | 'info';
  onConfirm: () => void;
  onCancel: () => void;
  loading?: boolean;
}

export function ConfirmModal({ open, title, message, confirmText = 'Onayla', cancelText = 'İptal', variant = 'danger', onConfirm, onCancel, loading }: ConfirmModalProps) {
  if (!open) return null;

  const btnClass = variant === 'danger' ? 'bg-red-600 hover:bg-red-700 text-white' : variant === 'warning' ? 'bg-amber-500 hover:bg-amber-600 text-white' : 'bg-blue-600 hover:bg-blue-700 text-white';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative bg-white dark:bg-slate-800 rounded-2xl shadow-xl max-w-md w-full p-6">
        <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-2">{title}</h3>
        <div className="text-sm text-slate-600 dark:text-slate-300 mb-6">{message}</div>
        <div className="flex justify-end gap-3">
          <button onClick={onCancel} disabled={loading} className="px-4 py-2 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-100 border border-slate-200 transition-colors">{cancelText}</button>
          <button onClick={onConfirm} disabled={loading} className={`px-4 py-2 rounded-xl text-sm font-semibold shadow-sm transition-all disabled:opacity-50 ${btnClass}`}>
            {loading ? 'İşleniyor...' : confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
