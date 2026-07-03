'use client';

import { useState } from 'react';
import { toTitleCaseTR } from '@/utils/text-helpers';
import { fmtDate } from './claim-detail-utils';

const PRIORITY_LABELS: Record<string, string> = {
  low: 'Düşük',
  normal: 'Normal',
  high: 'Yüksek',
  critical: 'Kritik',
};

function formatPriority(priority: string | null | undefined): string {
  if (!priority) return '—';
  const key = String(priority).trim().toLowerCase();
  return PRIORITY_LABELS[key] ?? toTitleCaseTR(priority);
}

function formatLossType(lossType: string | null | undefined): string {
  if (!lossType) return '—';
  return toTitleCaseTR(String(lossType));
}

export function buildDosyaBilgileriFields(claim: any) {
  return [
    { label: 'Dosya No', value: claim.fileNo ?? '—' },
    { label: 'Hasar No', value: claim.claimNo ?? '—' },
    { label: 'Hasar Tipi', value: formatLossType(claim.lossType) },
    { label: 'Hasar Tarihi', value: fmtDate(claim.incidentDate) },
    { label: 'İhbar Tarihi', value: fmtDate(claim.notificationDate) },
    { label: 'Sigorta Şirketi', value: claim.insuranceCompany?.name ?? '—' },
    { label: 'Durum', value: claim.currentStatus?.name ?? '—' },
    { label: 'Öncelik', value: formatPriority(claim.priority) },
    { label: 'SLA', value: fmtDate(claim.slaDueAt) },
  ];
}

function buildDosyaBilgileriSubtitle(claim: any): string {
  return [
    claim.claimNo && `Hasar ${claim.claimNo}`,
    claim.lossType && formatLossType(claim.lossType),
    claim.insuranceCompany?.name,
    claim.currentStatus?.name,
  ]
    .filter(Boolean)
    .join(' · ');
}

/** Üst bantta özet altında açılır dosya detayı — tüm sekmelerde görünür */
export function DosyaBilgileriDetay({ claim }: { claim: any }) {
  const [open, setOpen] = useState(false);
  const fields = buildDosyaBilgileriFields(claim);
  const subtitle = buildDosyaBilgileriSubtitle(claim);

  return (
    <div className="border-t border-slate-100">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-3 px-4 py-2.5 text-left hover:bg-slate-50/80 transition-colors"
      >
        <div className="min-w-0">
          <p className="text-[11px] font-semibold text-slate-600">Dosya Bilgileri</p>
          {!open && subtitle && (
            <p className="text-xs text-slate-400 mt-0.5 truncate">{subtitle}</p>
          )}
        </div>
        <span className="text-xs font-medium text-blue-600 shrink-0">{open ? 'Gizle' : 'Detay'}</span>
      </button>
      {open && (
        <div className="px-4 pb-3 pt-0 border-t border-slate-100 bg-slate-50/40">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-x-4 gap-y-3 pt-3">
            {fields.map((f) => (
              <div key={f.label} className="text-center">
                <p className="text-[11px] text-slate-400">{f.label}</p>
                <p className="text-xs font-medium text-slate-800 mt-0.5">{f.value}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
