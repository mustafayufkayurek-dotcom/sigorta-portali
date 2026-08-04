'use client';

import { useEffect, useState } from 'react';
import { toTitleCaseTR } from '@/utils/text-helpers';

type AttendanceSignatureModalProps = {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  expectedFullName: string | null;
  loading?: boolean;
  onClose: () => void;
  onConfirm: (signature: string) => void;
};

function normalizeName(value: string): string {
  return value
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/İ/g, 'i')
    .replace(/I/g, 'ı')
    .replace(/Ğ/g, 'ğ')
    .replace(/Ü/g, 'ü')
    .replace(/Ş/g, 'ş')
    .replace(/Ö/g, 'ö')
    .replace(/Ç/g, 'ç');
}

export function AttendanceSignatureModal({
  open,
  title,
  description,
  confirmLabel,
  expectedFullName,
  loading = false,
  onClose,
  onConfirm,
}: AttendanceSignatureModalProps) {
  const [signature, setSignature] = useState('');
  const [warning, setWarning] = useState('');
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    if (!open) return;
    setSignature(expectedFullName ? toTitleCaseTR(expectedFullName) : '');
    setWarning('');
    setChecked(false);
  }, [open, expectedFullName]);

  const checkSignature = (value: string) => {
    const trimmed = toTitleCaseTR(value.trim());
    if (!trimmed) {
      setWarning('');
      return;
    }
    if (!expectedFullName) {
      setWarning('');
      return;
    }
    if (normalizeName(trimmed) !== normalizeName(expectedFullName)) {
      setWarning(
        `Girilen isim (${trimmed}) hesabınızdaki isimle (${expectedFullName}) uyuşmuyor.`,
      );
    } else {
      setWarning('');
    }
  };

  if (!open) return null;

  const signatureValid = signature.trim().length > 0 && !warning;

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/50 px-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl">
        <div className="border-b border-slate-100 px-5 py-4">
          <h2 className="text-base font-bold text-slate-900">{title}</h2>
          <p className="mt-1 text-xs leading-relaxed text-slate-600">{description}</p>
        </div>

        <div className="space-y-4 px-5 py-4">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-600">
              Ad Soyad (Dijital İmza)
            </label>
            <input
              type="text"
              value={signature}
              onChange={(e) => {
                setSignature(e.target.value);
                checkSignature(e.target.value);
              }}
              onBlur={(e) => {
                const v = toTitleCaseTR(e.target.value.trim());
                if (v) setSignature(v);
                checkSignature(v);
              }}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              placeholder="Adınız ve soyadınız"
              autoComplete="name"
            />
            {warning && <p className="mt-1.5 text-xs text-amber-700">{warning}</p>}
          </div>

          <label className="flex items-start gap-2 text-xs text-slate-600">
            <input
              type="checkbox"
              checked={checked}
              onChange={(e) => setChecked(e.target.checked)}
              className="mt-0.5"
            />
            <span>
              Puantaj kayıtlarını inceledim; ad-soyad yazarak dijital onay verdiğimi kabul ediyorum.
              Bu onay 5070 sayılı Kanun kapsamında nitelikli e-imza değildir; zaman damgalı &quot;adi delil&quot; niteliğindedir.
            </span>
          </label>
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-100 px-5 py-4">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
          >
            Vazgeç
          </button>
          <button
            type="button"
            disabled={!checked || !signatureValid || loading}
            onClick={() => onConfirm(toTitleCaseTR(signature.trim()))}
            className="rounded-lg bg-[#1a4080] px-4 py-2 text-xs font-medium text-white hover:bg-[#153366] disabled:opacity-50"
          >
            {loading ? 'Kaydediliyor…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
