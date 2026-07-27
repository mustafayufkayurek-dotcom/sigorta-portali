'use client';

import { useState } from 'react';
import { toTitleCaseTR } from '@/utils/text-helpers';

export type VendorQuote = { vendorName: string; unitPrice: string };

export type VendorQuoteData = {
  preferredVendorName?: string;
  alternatives?: VendorQuote[];
};

export function parseVendorQuoteData(metrajData: unknown): VendorQuoteData {
  if (!metrajData || typeof metrajData !== 'object') return {};
  const raw = metrajData as Record<string, unknown>;
  const alternatives = Array.isArray(raw.alternatives)
    ? raw.alternatives
        .filter((a) => a && typeof a === 'object')
        .map((a) => {
          const row = a as Record<string, unknown>;
          return {
            vendorName: String(row.vendorName ?? ''),
            unitPrice: String(row.unitPrice ?? ''),
          };
        })
    : [];
  return {
    preferredVendorName: raw.preferredVendorName ? String(raw.preferredVendorName) : undefined,
    alternatives,
  };
}

export function buildVendorQuoteMetrajData(
  existing: unknown,
  data: VendorQuoteData,
): Record<string, unknown> {
  const base = existing && typeof existing === 'object' ? { ...(existing as object) } : {};
  return {
    ...base,
    preferredVendorName: data.preferredVendorName?.trim() || undefined,
    alternatives: (data.alternatives ?? [])
      .filter((a) => a.vendorName.trim() || a.unitPrice.trim())
      .map((a) => ({
        vendorName: toTitleCaseTR(a.vendorName.trim()),
        unitPrice: a.unitPrice.trim(),
      })),
  };
}

export default function VendorQuotePopover({
  data,
  onChange,
  onApplyPrice,
}: {
  data: VendorQuoteData;
  onChange: (next: VendorQuoteData) => void;
  onApplyPrice: (price: string, vendorName: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const alternatives = data.alternatives?.length ? data.alternatives : [{ vendorName: '', unitPrice: '' }];

  const updateAlt = (idx: number, patch: Partial<VendorQuote>) => {
    const next = [...alternatives];
    next[idx] = { ...next[idx], ...patch };
    onChange({ ...data, alternatives: next });
  };

  const addAlt = () => onChange({ ...data, alternatives: [...alternatives, { vendorName: '', unitPrice: '' }] });

  return (
    <div className="relative">
      <button
        type="button"
        title="Tedarikçi Karşılaştır"
        onClick={() => setOpen((v) => !v)}
        className="text-[10px] text-brand-600 hover:text-brand-800 font-medium whitespace-nowrap"
      >
        Karşılaştır
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 z-20 w-56 bg-white border border-slate-200 rounded-lg shadow-lg p-2 space-y-2">
          <p className="text-[10px] font-semibold text-slate-600">Tedarikçi Karşılaştırma</p>
          <input
            className="w-full border border-slate-200 rounded px-2 py-1 text-[10px]"
            placeholder="Tercih edilen tedarikçi"
            value={data.preferredVendorName ?? ''}
            onChange={(e) => onChange({ ...data, preferredVendorName: e.target.value })}
            onBlur={(e) => {
              const v = toTitleCaseTR(e.target.value.trim());
              if (v) onChange({ ...data, preferredVendorName: v });
            }}
          />
          {alternatives.map((alt, idx) => (
            <div key={idx} className="flex gap-1">
              <input
                className="flex-1 border border-slate-200 rounded px-1.5 py-1 text-[10px]"
                placeholder="Tedarikçi"
                value={alt.vendorName}
                onChange={(e) => updateAlt(idx, { vendorName: e.target.value })}
              />
              <input
                className="w-16 border border-slate-200 rounded px-1.5 py-1 text-[10px] text-right"
                placeholder="Fiyat"
                value={alt.unitPrice}
                onChange={(e) => updateAlt(idx, { unitPrice: e.target.value })}
              />
              <button
                type="button"
                title="Bu fiyatı uygula"
                className="text-[10px] text-emerald-600 hover:text-emerald-800 px-1"
                onClick={() => {
                  if (alt.unitPrice.trim()) {
                    onApplyPrice(alt.unitPrice, alt.vendorName);
                    setOpen(false);
                  }
                }}
              >
                ✓
              </button>
            </div>
          ))}
          <button type="button" onClick={addAlt} className="text-[10px] text-brand-600 hover:text-blue-800">
            + Alternatif Ekle
          </button>
        </div>
      )}
    </div>
  );
}
