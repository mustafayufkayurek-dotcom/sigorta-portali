'use client';

import type { ReactNode } from 'react';

type NewFilePanelShellProps = {
  children: ReactNode;
  errorGeneral?: string;
  onCancel: () => void;
  saving: boolean;
};

/** SlidePanel içi tek sayfa form: üstte içerik, altta sabit footer; gereksiz boş kaydırma yok */
export function NewFilePanelShell({ children, errorGeneral, onCancel, saving }: NewFilePanelShellProps) {
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-white">
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain">
        <div className="px-4 py-2 pb-2">{children}</div>
      </div>
      {errorGeneral && (
        <p className="shrink-0 text-xs text-red-600 px-4 py-2 bg-red-50 border-t border-red-100">{errorGeneral}</p>
      )}
      <div className="sticky bottom-0 z-10 shrink-0 flex items-center justify-between gap-3 border-t border-slate-200 bg-white px-4 py-2.5 shadow-[0_-4px_12px_rgba(15,23,42,0.06)]">
        <button type="button" onClick={onCancel} className="px-3 py-2 text-sm text-slate-600 hover:bg-slate-50 rounded-lg">
          İptal
        </button>
        <button
          type="submit"
          disabled={saving}
          className="px-5 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg disabled:opacity-50 shadow-sm"
        >
          {saving ? 'Kaydediliyor...' : 'Dosyayı Oluştur'}
        </button>
      </div>
    </div>
  );
}
