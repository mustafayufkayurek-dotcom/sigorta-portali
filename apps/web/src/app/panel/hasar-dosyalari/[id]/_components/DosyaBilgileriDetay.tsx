'use client';

import { useState } from 'react';
import axios from 'axios';
import { API, authHeader } from '@/utils/api';
import { toTitleCaseTR, resolveClaimIhbarKonusu } from '@/utils/text-helpers';
import { fmtDate } from './claim-detail-utils';
import { resolveHasarInsuredName } from '@/utils/claim-insured-display';

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

function resolveDosyaEksperi(claim: any): string {
  const vendorName = claim.assignedInspectorVendor?.name?.trim();
  if (vendorName) return toTitleCaseTR(vendorName);
  const inspector = claim.inspector?.trim() || claim.inspectorName?.trim();
  if (inspector) return toTitleCaseTR(inspector);
  return '—';
}

function resolveIhbarTarihi(claim: any): string {
  if (claim.notificationDate) return fmtDate(claim.notificationDate);
  if (claim.createdAt) return fmtDate(claim.createdAt);
  return '—';
}

export function buildDosyaBilgileriFields(claim: any): DosyaField[] {
  const core: DosyaField[] = [
    { label: 'İhbar Tarihi', value: resolveIhbarTarihi(claim) },
    { label: 'Öncelik', value: formatPriority(claim.priority) },
    { label: 'SLA', value: fmtDate(claim.slaDueAt) },
    { label: 'Dosya Eksperi', value: resolveDosyaEksperi(claim) },
  ];

  const supplementary: DosyaField[] = [];
  if (claim.policyNo?.trim()) {
    supplementary.push({ label: 'Poliçe No', value: claim.policyNo.trim() });
  }
  if (claim.productBranch?.trim()) {
    supplementary.push({ label: 'Ürün Branşı', value: toTitleCaseTR(claim.productBranch.trim()) });
  }
  const ihbarKonusu = resolveClaimIhbarKonusu(claim);
  if (ihbarKonusu !== '—') {
    supplementary.push({ label: 'İhbar Konusu', value: ihbarKonusu });
  }
  if (claim.sourceChannel?.trim()) {
    supplementary.push({ label: 'Kaynak Kanal', value: toTitleCaseTR(claim.sourceChannel.trim()) });
  }
  if (claim.fileType?.trim()) {
    supplementary.push({ label: 'Dosya Tipi', value: toTitleCaseTR(claim.fileType.trim()) });
  }

  const insuredName = resolveHasarInsuredName(claim);
  supplementary.push({ label: 'Sigortalı Ad Soyad', value: insuredName, wide: true });

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
  const notification = resolveIhbarTarihi(claim);
  if (notification !== '—') parts.push(`İhbar ${notification}`);
  const eksper = resolveDosyaEksperi(claim);
  if (eksper !== '—') parts.push(eksper);
  const priority = formatPriority(claim.priority);
  if (priority !== '—') parts.push(priority);
  const sla = fmtDate(claim.slaDueAt);
  if (sla !== '—') parts.push(`SLA ${sla}`);
  return parts.join(' · ');
}

function InsuredNameEditor({
  claimId,
  onSaved,
}: {
  claimId: string;
  onSaved: (insuredName: string) => void;
}) {
  const [value, setValue] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const save = async () => {
    const name = toTitleCaseTR(value.trim());
    if (!name) {
      setError('Sigortalı adı soyadı girin');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await axios.patch(`${API}/claim-files/${claimId}`, { insuredName: name }, { headers: authHeader() });
      onSaved(name);
    } catch (e: unknown) {
      const msg = axios.isAxiosError(e)
        ? e.response?.data?.message ?? e.message
        : 'Kaydedilemedi';
      setError(Array.isArray(msg) ? msg.join(', ') : String(msg));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50/60 p-3 space-y-2">
      <p className="text-[11px] text-amber-900">Sigortalı adı kayıtlı değil — lütfen ekleyin.</p>
      <div className="flex flex-wrap gap-2">
        <input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Sigortalı adı soyadı"
          className="flex-1 min-w-[180px] rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-800"
        />
        <button
          type="button"
          onClick={() => void save()}
          disabled={saving}
          className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-medium text-white disabled:opacity-50"
        >
          {saving ? 'Kaydediliyor…' : 'Kaydet'}
        </button>
      </div>
      {error && <p className="text-[11px] text-red-600">{error}</p>}
    </div>
  );
}

/** Üst bantta özet altında açılır dosya detayı — tüm sekmelerde görünür */
export function DosyaBilgileriDetay({
  claim,
  onClaimUpdated,
  initialOpen = false,
}: {
  claim: any;
  onClaimUpdated?: (patch: Partial<any>) => void;
  initialOpen?: boolean;
}) {
  const [open, setOpen] = useState(initialOpen);
  const fields = buildDosyaBilgileriFields(claim);
  const subtitle = buildDosyaBilgileriSubtitle(claim);
  const compactFields = fields.filter((field) => !field.wide);
  const wideFields = fields.filter((field) => field.wide);
  const insuredMissing = !claim.insuredName?.trim() && resolveHasarInsuredName(claim) === '—';

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
          {insuredMissing && onClaimUpdated && (
            <div className="pt-3">
              <InsuredNameEditor
                claimId={claim.id}
                onSaved={(insuredName) => onClaimUpdated({ insuredName })}
              />
            </div>
          )}
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
