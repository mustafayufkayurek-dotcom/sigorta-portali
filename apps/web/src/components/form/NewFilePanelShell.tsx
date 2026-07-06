'use client';

import type { ReactNode } from 'react';

type NewFilePanelShellProps = {
  children: ReactNode;
  errorGeneral?: string;
  onCancel: () => void;
  saving: boolean;
};

/** SlidePanel içi tek sayfa form: ortada kaydırılabilir alan, altta her zaman görünür footer */
export function NewFilePanelShell({ children, errorGeneral, onCancel, saving }: NewFilePanelShellProps) {
  return (
    <div
      className={`grid h-full min-h-0 w-full flex-1 overflow-hidden bg-white ${
        errorGeneral ? 'grid-rows-[minmax(0,1fr)_auto_auto]' : 'grid-rows-[minmax(0,1fr)_auto]'
      }`}
    >
      <div className="min-h-0 overflow-y-auto overscroll-y-contain">
        <div className="px-4 py-3 pb-4">{children}</div>
      </div>
      {errorGeneral && (
        <p className="border-t border-red-100 bg-red-50 px-4 py-2 text-xs text-red-600">{errorGeneral}</p>
      )}
      <div className="z-10 flex shrink-0 items-center justify-between gap-3 border-t border-slate-200 bg-white px-4 py-3 shadow-[0_-4px_12px_rgba(15,23,42,0.08)]">
        <button type="button" onClick={onCancel} className="rounded-lg px-3 py-2 text-sm text-slate-600 hover:bg-slate-50">
          İptal
        </button>
        <button
          type="submit"
          disabled={saving}
          className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 disabled:opacity-50"
        >
          {saving ? 'Kaydediliyor...' : 'Dosyayı Oluştur'}
        </button>
      </div>
    </div>
  );
}
