'use client';

import { useState } from 'react';

/**
 * Silme için iki adımlı onay — 1) uyarı 2) dosya no yazarak teyit.
 */
export function DoubleDeleteConfirm({
  open,
  fileNo,
  onConfirm,
  onCancel,
  loading,
}: {
  open: boolean;
  fileNo: string;
  onConfirm: () => void;
  onCancel: () => void;
  loading?: boolean;
}) {
  const [step, setStep] = useState<1 | 2>(1);
  const [typed, setTyped] = useState('');

  if (!open) return null;

  const close = () => {
    setStep(1);
    setTyped('');
    onCancel();
  };

  const confirmStep1 = () => setStep(2);
  const canConfirm = typed.trim() === fileNo.trim();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={close} />
      <div className="relative bg-white dark:bg-slate-800 rounded-2xl shadow-xl max-w-md w-full p-6">
        {step === 1 ? (
          <>
            <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-2">Silme Onayı (1/2)</h3>
            <p className="text-sm text-slate-600 dark:text-slate-300 mb-6">
              <span className="font-semibold font-mono">{fileNo}</span> dosyasını silmek / iptal etmek istediğinize emin misiniz?
              Bu işlem geri alınamaz.
            </p>
            <div className="flex justify-end gap-3">
              <button type="button" onClick={close} className="px-4 py-2 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-100 border border-slate-200">
                Vazgeç
              </button>
              <button type="button" onClick={confirmStep1} className="px-4 py-2 rounded-xl text-sm font-semibold bg-amber-500 hover:bg-amber-600 text-white">
                Devam Et
              </button>
            </div>
          </>
        ) : (
          <>
            <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-2">Silme Onayı (2/2)</h3>
            <p className="text-sm text-slate-600 dark:text-slate-300 mb-3">
              Onaylamak için dosya numarasını yazın: <span className="font-mono font-semibold">{fileNo}</span>
            </p>
            <input
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm mb-6 focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-400"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              placeholder="Dosya no"
              autoFocus
            />
            <div className="flex justify-end gap-3">
              <button type="button" onClick={close} disabled={loading} className="px-4 py-2 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-100 border border-slate-200">
                Vazgeç
              </button>
              <button
                type="button"
                disabled={!canConfirm || loading}
                onClick={onConfirm}
                className="px-4 py-2 rounded-xl text-sm font-semibold bg-red-600 hover:bg-red-700 text-white disabled:opacity-50"
              >
                {loading ? 'İşleniyor...' : 'Kalıcı Olarak Onayla'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
