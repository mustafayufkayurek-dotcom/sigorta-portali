'use client';

import { useEffect } from 'react';
import { toTitleCaseTR } from '@/utils/text-helpers';
import {
  type VendorQuote,
  type VendorQuoteData,
} from '@/components/damage-reports/VendorQuotePopover';

const VENDOR_PRICE_STORAGE_KEY = 'repair-report-vendor-prices';

type StoredVendorPrices = Record<string, VendorQuoteData>;

function storageKey(workGroupId: string, jobDescription: string): string {
  return `${workGroupId}::${jobDescription.trim().toLowerCase()}`;
}

export function readVendorPriceMemory(workGroupId: string, jobDescription: string): VendorQuoteData | null {
  if (typeof window === 'undefined' || !workGroupId || !jobDescription.trim()) return null;
  try {
    const raw = localStorage.getItem(VENDOR_PRICE_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredVendorPrices;
    return parsed[storageKey(workGroupId, jobDescription)] ?? null;
  } catch {
    return null;
  }
}

export function writeVendorPriceMemory(
  workGroupId: string,
  jobDescription: string,
  data: VendorQuoteData,
): void {
  if (typeof window === 'undefined' || !workGroupId || !jobDescription.trim()) return;
  try {
    const raw = localStorage.getItem(VENDOR_PRICE_STORAGE_KEY);
    const parsed: StoredVendorPrices = raw ? JSON.parse(raw) : {};
    parsed[storageKey(workGroupId, jobDescription)] = data;
    localStorage.setItem(VENDOR_PRICE_STORAGE_KEY, JSON.stringify(parsed));
  } catch {
    /* ignore */
  }
}

export default function VendorQuoteModal({
  open,
  onClose,
  data,
  onChange,
  onApplyPrice,
  workGroupId,
  jobDescription,
}: {
  open: boolean;
  onClose: () => void;
  data: VendorQuoteData;
  onChange: (next: VendorQuoteData) => void;
  onApplyPrice: (price: string, vendorName: string) => void;
  workGroupId: string;
  jobDescription: string;
}) {
  const alternatives = data.alternatives?.length ? data.alternatives : [{ vendorName: '', unitPrice: '' }];

  useEffect(() => {
    if (!open || !workGroupId || !jobDescription.trim()) return;
    const stored = readVendorPriceMemory(workGroupId, jobDescription);
    if (stored && (!data.alternatives?.length && !data.preferredVendorName)) {
      onChange(stored);
    }
  }, [open, workGroupId, jobDescription]); // eslint-disable-line react-hooks/exhaustive-deps

  const persist = (next: VendorQuoteData) => {
    onChange(next);
    if (workGroupId && jobDescription.trim()) {
      writeVendorPriceMemory(workGroupId, jobDescription, next);
    }
  };

  const updateAlt = (idx: number, patch: Partial<VendorQuote>) => {
    const next = [...alternatives];
    next[idx] = { ...next[idx], ...patch };
    persist({ ...data, alternatives: next });
  };

  const addAlt = () => persist({ ...data, alternatives: [...alternatives, { vendorName: '', unitPrice: '' }] });

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="w-full max-w-2xl rounded-2xl border border-slate-200 bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <div>
            <h3 className="text-sm font-semibold text-slate-800">Tedarikçi Karşılaştırma</h3>
            {jobDescription && (
              <p className="text-xs text-slate-500 mt-0.5">{toTitleCaseTR(jobDescription)}</p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 text-lg leading-none"
            aria-label="Kapat"
          >
            ×
          </button>
        </div>

        <div className="px-5 py-4 space-y-4">
          <div>
            <label className="text-xs text-slate-500 block mb-1">Tercih Edilen Tedarikçi</label>
            <input
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
              placeholder="Tercih edilen tedarikçi"
              value={data.preferredVendorName ?? ''}
              onChange={(e) => persist({ ...data, preferredVendorName: e.target.value })}
              onBlur={(e) => {
                const v = toTitleCaseTR(e.target.value.trim());
                if (v) persist({ ...data, preferredVendorName: v });
              }}
            />
          </div>

          <div className="space-y-2">
            <p className="text-xs font-medium text-slate-600">Alternatif Fiyatlar</p>
            {alternatives.map((alt, idx) => (
              <div key={idx} className="flex flex-wrap items-center gap-2">
                <input
                  className="flex-1 min-w-[140px] border border-slate-200 rounded-lg px-3 py-2 text-sm"
                  placeholder="Tedarikçi"
                  value={alt.vendorName}
                  onChange={(e) => updateAlt(idx, { vendorName: e.target.value })}
                  onBlur={(e) => {
                    const v = toTitleCaseTR(e.target.value.trim());
                    if (v) updateAlt(idx, { vendorName: v });
                  }}
                />
                <input
                  className="w-28 border border-slate-200 rounded-lg px-3 py-2 text-sm text-right"
                  placeholder="Fiyat"
                  value={alt.unitPrice}
                  onChange={(e) => updateAlt(idx, { unitPrice: e.target.value })}
                />
                <button
                  type="button"
                  title="Bu fiyatı uygula"
                  className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-medium text-white hover:bg-emerald-700"
                  onClick={() => {
                    if (alt.unitPrice.trim()) {
                      onApplyPrice(alt.unitPrice, alt.vendorName);
                      onClose();
                    }
                  }}
                >
                  Uygula
                </button>
              </div>
            ))}
            <button type="button" onClick={addAlt} className="text-xs font-medium text-blue-600 hover:text-blue-800">
              + Alternatif Ekle
            </button>
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-100 px-5 py-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50"
          >
            Kapat
          </button>
        </div>
      </div>
    </div>
  );
}
