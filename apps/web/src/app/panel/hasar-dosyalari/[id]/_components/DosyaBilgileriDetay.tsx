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

type DosyaField = {
  label: string;
  value: string;
  wide?: boolean;
};

function formatPriority(priority: string | null | undefined): string {
  if (!priority) return '—';
  const key = String(priority).trim().toLowerCase();
  return PRIORITY_LABELS[key] ?? toTitleCaseTR(priority);
}

function resolveInsuredDisplayName(claim: any): string | null {
  if (claim.insuredName?.trim()) {
    return toTitleCaseTR(claim.insuredName.trim());
  }
  const customer = claim.customer;
  if (!customer) return null;
  const entityType = String(customer.entityType ?? customer.type ?? '').trim().toLowerCase();
  if (entityType === 'corporate') return null;
  if (customer.fullName?.trim()) return toTitleCaseTR(customer.fullName.trim());
  return null;
}

function formatPropertyAddress(claim: any): string | null {
  const address = claim.propertyAddress;
  if (!address) return null;
  const line = [
    address.city,
    address.district,
    address.neighborhood,
    address.addressLine,
  ]
    .filter(Boolean)
    .join(' · ');
  return line || null;
}

export function buildDosyaBilgileriFields(claim: any): DosyaField[] {
  const core: DosyaField[] = [
    { label: 'Hasar Tarihi', value: fmtDate(claim.incidentDate) },
    { label: 'İhbar Tarihi', value: fmtDate(claim.notificationDate) },
    { label: 'Öncelik', value: formatPriority(claim.priority) },
    { label: 'SLA', value: fmtDate(claim.slaDueAt) },
  ];

  const supplementary: DosyaField[] = [];
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

  const insuredName = resolveInsuredDisplayName(claim);
  if (insuredName) {
    supplementary.push({ label: 'Sigortalı Ad Soyad', value: insuredName, wide: true });
  }

  const propertyAddress = formatPropertyAddress(claim);
  if (propertyAddress) {
    supplementary.push({ label: 'Hasar Adresi', value: propertyAddress, wide: true });
  }

  if (claim.description?.trim()) {
    supplementary.push({
      label: 'İhbar İçeriği',
      value: claim.description.trim(),
      wide: true,
    });
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
  const compactFields = fields.filter((field) => !field.wide);
  const wideFields = fields.filter((field) => field.wide);

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
          {compactFields.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-x-4 gap-y-3 pt-3">
              {compactFields.map((field) => (
                <div key={field.label} className="text-center">
                  <p className="text-[11px] text-slate-400">{field.label}</p>
                  <p className="text-xs font-medium text-slate-800 mt-0.5">{field.value}</p>
                </div>
              ))}
            </div>
          )}
          {wideFields.length > 0 && (
            <div className={`space-y-3 ${compactFields.length > 0 ? 'mt-3 pt-3 border-t border-slate-100' : 'pt-3'}`}>
              {wideFields.map((field) => (
                <div key={field.label}>
                  <p className="text-[11px] text-slate-400">{field.label}</p>
                  <p className="text-xs font-medium text-slate-800 mt-0.5 whitespace-pre-wrap break-words">
                    {field.value}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
