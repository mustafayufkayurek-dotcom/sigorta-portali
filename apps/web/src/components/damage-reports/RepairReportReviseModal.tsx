'use client';

import { useState } from 'react';

const REASON_OPTIONS = [
  { value: 'PRICE_CORRECTION', label: 'Fiyat Düzeltmesi' },
  { value: 'ITEM_ADD_REMOVE', label: 'Kalem Ekleme veya Çıkarma' },
  { value: 'MEASUREMENT_FIX', label: 'Metraj Düzeltmesi' },
  { value: 'SCOPE_CHANGE', label: 'Kapsam Değişikliği' },
  { value: 'MISSING_DOCUMENT', label: 'Eksik Evrak' },
  { value: 'OTHER', label: 'Diğer' },
] as const;

const SECTION_OPTIONS = [
  { value: 'items', label: 'Onarım Kalemleri' },
  { value: 'findings', label: 'Tespit Bulguları' },
  { value: 'photos', label: 'Fotoğraflar' },
  { value: 'budget', label: 'Dosya Bütçesi' },
  { value: 'legal', label: 'Yasal Notlar' },
];

export type ReviseReportPayload = {
  reason: string;
  reasonNote: string;
  affectedSections: string[];
};

export default function RepairReportReviseModal({
  reportNo,
  versionNo,
  onClose,
  onConfirm,
  submitting,
}: {
  reportNo: string;
  versionNo?: number;
  onClose: () => void;
  onConfirm: (payload: ReviseReportPayload) => void;
  submitting?: boolean;
}) {
  const [reason, setReason] = useState('ITEM_ADD_REMOVE');
  const [reasonNote, setReasonNote] = useState('');
  const [sections, setSections] = useState<string[]>(['items']);

  const toggleSection = (value: string) => {
    setSections((prev) => (prev.includes(value) ? prev.filter((s) => s !== value) : [...prev, value]));
  };

  const canSubmit = reasonNote.trim().length >= 10 && sections.length > 0 && !submitting;

  return (
    <div className="fixed inset-0 bg-black/50 z-[70] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg">
        <div className="px-6 py-4 border-b border-slate-100">
          <h3 className="text-base font-semibold text-slate-900">Rapor Revizyonu</h3>
          <p className="text-xs text-slate-500 mt-1">
            {reportNo}{versionNo ? ` · v${versionNo}` : ''} — onaylı sürüm arşivlenir; yeni taslak açılır ve revizyon geçmişine kaydedilir.
          </p>
        </div>
        <div className="px-6 py-4 space-y-4">
          <div>
            <label className="text-xs font-medium text-slate-600 block mb-1">Revizyon Nedeni</label>
            <select
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            >
              {REASON_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600 block mb-1">Açıklama (en az 10 karakter)</label>
            <textarea
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm min-h-[80px] resize-y"
              placeholder="Ne değişecek, neden revize ediliyor?"
              value={reasonNote}
              onChange={(e) => setReasonNote(e.target.value)}
            />
          </div>
          <div>
            <p className="text-xs font-medium text-slate-600 mb-2">Etkilenen Bölümler</p>
            <div className="flex flex-wrap gap-2">
              {SECTION_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => toggleSection(opt.value)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                    sections.includes(opt.value)
                      ? 'bg-orange-50 border-orange-300 text-orange-800'
                      : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg border border-slate-200 text-sm text-slate-600 hover:bg-slate-50">
            İptal
          </button>
          <button
            type="button"
            disabled={!canSubmit}
            onClick={() => onConfirm({ reason, reasonNote: reasonNote.trim(), affectedSections: sections })}
            className="px-4 py-2 rounded-lg bg-orange-500 text-white text-sm font-medium hover:bg-orange-600 disabled:opacity-40"
          >
            {submitting ? 'Oluşturuluyor...' : 'Revizyon Taslağı Aç'}
          </button>
        </div>
      </div>
    </div>
  );
}
