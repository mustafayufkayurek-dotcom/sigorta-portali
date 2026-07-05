'use client';

import { useState } from 'react';
import { toTitleCaseTR, formatDisplayLabel } from '@/utils/text-helpers';
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

export function buildDosyaBilgileriFields(claim: any) {
  const core = [
    { label: 'Hasar Tarihi', value: fmtDate(claim.incidentDate) },
    { label: 'İhbar Tarihi', value: fmtDate(claim.notificationDate) },
    { label: 'Öncelik', value: formatPriority(claim.priority) },
    { label: 'SLA', value: fmtDate(claim.slaDueAt) },
  ];

  const supplementary: { label: string; value: string }[] = [];
  if (claim.policyNo?.trim()) {
    supplementary.push({ label: 'Poliçe No', value: claim.policyNo.trim() });
  }
  if (claim.productBranch?.trim()) {
    supplementary.push({ label: 'Ürün Branşı', value: formatDisplayLabel(claim.productBranch.trim()) });
  }
  if (claim.lossType?.trim()) {
    supplementary.push({ label: 'Hasar Konusu', value: formatDisplayLabel(claim.lossType.trim()) });
  }
  if (claim.sourceChannel?.trim()) {
    supplementary.push({ label: 'Kaynak Kanal', value: toTitleCaseTR(claim.sourceChannel.trim()) });
  }
  if (claim.fileType?.trim()) {
    supplementary.push({ label: 'Dosya Tipi', value: toTitleCaseTR(claim.fileType.trim()) });
  }
  if (claim.insuredName?.trim()) {
    supplementary.push({ label: 'Sigortalı', value: toTitleCaseTR(claim.insuredName.trim()) });
  }
  if (claim.description?.trim()) {
    supplementary.push({ label: 'Açıklama', value: claim.description.trim() });
  }

  return [...core, ...supplementary];
}

function buildDosyaBilgileriSubtitle(claim: any): string {
  const parts: string[] = [];
  const notification = fmtDate(claim.notificationDate);
  if (notification !== '—') parts.push(`İhbar ${notification}`);
  const incident = fmtDate(claim.incidentDate);
  if (incident !== '—') parts.push(`Hasar ${incident}`);
  const priority = formatPriority(claim.priority);
  if (priority !== '—') parts.push(priority);
  const sla = fmtDate(claim.slaDueAt);
  if (sla !== '—') parts.push(`SLA ${sla}`);
  return parts.join(' · ');
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
