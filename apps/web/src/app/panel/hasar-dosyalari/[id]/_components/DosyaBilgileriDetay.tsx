'use client';

import { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { API, authHeader } from '@/utils/api';
import { resolveFileExpertDisplay } from '@sigorta/shared';
import { toTitleCaseTR, resolveClaimIhbarKonusu, formatDisplayLabel, formatHasarAdresi } from '@/utils/text-helpers';
import { fmtDate } from './claim-detail-utils';
import { resolveHasarInsuredName } from '@/utils/claim-insured-display';
import {
  damageSizeLabel,
} from '@/components/damage-reports/RepairItemsModal';
import {
  inferQuickDamageTypesFromReport,
  buildQuickDamageDisplayOptions,
  quickDamageTypeDisplayLabel,
} from '@/utils/quick-repair-damage-types';
import { DosyaBilgileriEditModal } from './DosyaBilgileriEditModal';

const PRIORITY_LABELS: Record<string, string> = {
  low: 'Düşük',
  normal: 'Normal',
  medium: 'Orta',
  high: 'Yüksek',
  critical: 'Kritik',
};

function userHasPermission(code: string): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const raw = localStorage.getItem('user') ?? localStorage.getItem('currentUser');
    if (!raw) return false;
    const u = JSON.parse(raw);
    return Array.isArray(u?.permissions) && u.permissions.includes(code);
  } catch {
    return false;
  }
}

function canEditDosyaBilgileri(): boolean {
  return userHasPermission('claim_file.update');
}

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
  if (!claim.propertyAddress) return null;
  return formatHasarAdresi(claim.propertyAddress);
}

export function resolveDosyaEksperi(claim: any, reportSummary?: any | null): string {
  const { name, missing } = resolveFileExpertDisplay({
    claimFile: claim,
    inspectorName: reportSummary?.inspectorName ?? claim.latestRepairReport?.inspectorName,
    expertOffice: reportSummary?.expertOffice ?? claim.latestRepairReport?.expertOffice,
  });
  return missing ? 'Atanmamış' : toTitleCaseTR(name);
}

/** API Date koruması bozulunca {} gelebilir; yalnızca parse edilebilir değerleri kabul et */
function asDateInput(value: unknown): string | null {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString();
  if (typeof value === 'string' && value.trim()) return value;
  return null;
}

export function resolveIhbarTarihi(claim: any): string {
  const inbound = asDateInput(claim?.inboundReceivedAt);
  if (inbound) return fmtDate(inbound);
  const notification = asDateInput(claim?.notificationDate);
  if (notification) return fmtDate(notification);
  return '—';
}

function mergeClaimIhbarFields(claim: any, reportSummary?: any | null): any {
  const fromReport = reportSummary?.claimFile;
  if (!fromReport) return claim;
  return {
    ...claim,
    inboundReceivedAt: claim.inboundReceivedAt ?? fromReport.inboundReceivedAt ?? null,
    notificationDate: claim.notificationDate ?? fromReport.notificationDate ?? null,
  };
}

function resolveHasarNedeni(claim: any, reportSummary: any | null): string {
  const damageTypes = reportSummary?.damageTypes ?? claim.latestRepairReport?.damageTypes;
  if (Array.isArray(damageTypes) && damageTypes.length > 0) {
    return damageTypes
      .map((dt: any) => formatDisplayLabel(dt.damageTypeName ?? dt.damageTypeCode ?? ''))
      .filter(Boolean)
      .join(' · ');
  }
  return '—';
}

function resolveQuickRepairSummary(reportSummary: any | null): string {
  if (!reportSummary) return '—';
  const stored = reportSummary.quickDamageTypes ?? [];
  const displayOptions = buildQuickDamageDisplayOptions(reportSummary);
  const labelMap = Object.fromEntries(displayOptions.map((o) => [o.value, o.label]));
  const inferred = inferQuickDamageTypesFromReport(reportSummary);
  const types = stored.length > 0 ? stored : inferred;
  if (!types.length) return '—';
  const size = reportSummary.quickDamageSize ?? 'MEDIUM';
  return `${types.map((v: string) => quickDamageTypeDisplayLabel(v, labelMap)).join(' + ')} (${damageSizeLabel(size)})`;
}

export function buildDosyaBilgileriFields(claim: any, reportSummary?: any | null): DosyaField[] {
  const core: DosyaField[] = [
    { label: 'İhbar Tarihi', value: resolveIhbarTarihi(claim) },
    { label: 'Hasar Konusu', value: resolveHasarNedeni(claim, reportSummary ?? null) },
    { label: 'Öncelik', value: formatPriority(claim.priority) },
    { label: 'SLA', value: fmtDate(claim.slaDueAt) },
    { label: 'Dosya Eksperi', value: resolveDosyaEksperi(claim, reportSummary ?? null) },
  ];

  const insuredPhone = typeof claim.insuredPhone === 'string' ? claim.insuredPhone.trim() : '';
  if (insuredPhone) {
    core.push({ label: 'Sigortalı Telefon', value: insuredPhone });
  }

  const quickRepairValue = resolveQuickRepairSummary(reportSummary ?? null);
  if (quickRepairValue !== '—') {
    core.push({ label: 'Hızlı Onarım Türü', value: quickRepairValue, wide: true });
  }

  const supplementary: DosyaField[] = [];
  if (claim.policyNo?.trim()) {
    supplementary.push({ label: 'Poliçe No', value: claim.policyNo.trim() });
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

  const propertyAddress = formatPropertyAddress(claim);
  supplementary.push({ label: 'Hasar Adresi', value: propertyAddress ?? 'Belirtilmemiş', wide: true });

  if (claim.description?.trim()) {
    supplementary.push({
      label: 'İhbar İçeriği',
      value: claim.description.trim(),
      wide: true,
    });
  }

  return [...core, ...supplementary];
}

function buildDosyaBilgileriSubtitle(claim: any, reportSummary?: any | null): string {
  const parts: string[] = [];
  const notification = resolveIhbarTarihi(claim);
  if (notification !== '—') parts.push(`İhbar ${notification}`);
  const eksper = resolveDosyaEksperi(claim, reportSummary ?? null);
  if (eksper !== 'Atanmamış' && eksper !== '—') parts.push(eksper);
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
          className="rounded-lg bg-brand-600 px-3 py-2 text-xs font-medium text-white disabled:opacity-50"
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
  initialEditOpen = false,
  repairReportId,
}: {
  claim: any;
  onClaimUpdated?: (patch: Partial<any>) => void;
  initialOpen?: boolean;
  /** Operasyon → Düzenle (?edit=1) ile dosya bilgileri düzenleme açılır */
  initialEditOpen?: boolean;
  repairReportId?: string | null;
}) {
  const [open, setOpen] = useState(initialOpen || initialEditOpen);
  const [editOpen, setEditOpen] = useState(false);
  const [reportSummary, setReportSummary] = useState<any | null>(null);
  const [canEdit, setCanEdit] = useState(false);

  useEffect(() => {
    setCanEdit(canEditDosyaBilgileri());
  }, []);

  useEffect(() => {
    if (!initialEditOpen) return;
    if (!canEdit || !onClaimUpdated) return;
    setOpen(true);
    setEditOpen(true);
  }, [initialEditOpen, canEdit, onClaimUpdated]);

  useEffect(() => {
    if (!repairReportId) {
      setReportSummary(null);
      return;
    }
    let cancelled = false;
    axios
      .get(`${API}/repair-reports/${repairReportId}`, { headers: authHeader() })
      .then((r) => {
        if (!cancelled) setReportSummary(r.data.data ?? null);
      })
      .catch(() => {
        if (!cancelled) setReportSummary(null);
      });
    return () => {
      cancelled = true;
    };
  }, [repairReportId]);

  const effectiveClaim = useMemo(
    () => mergeClaimIhbarFields(claim, reportSummary),
    [claim, reportSummary],
  );

  const fields = buildDosyaBilgileriFields(effectiveClaim, reportSummary);
  const subtitleParts: string[] = [];
  const hasarNedeni = resolveHasarNedeni(effectiveClaim, reportSummary);
  if (hasarNedeni !== '—') subtitleParts.push(hasarNedeni);
  const quickRepair = resolveQuickRepairSummary(reportSummary);
  if (quickRepair !== '—') subtitleParts.push(quickRepair);
  const baseSubtitle = buildDosyaBilgileriSubtitle(effectiveClaim, reportSummary);
  if (baseSubtitle) subtitleParts.push(baseSubtitle);
  const subtitle = subtitleParts.join(' · ');
  const compactFields = fields.filter((field) => !field.wide);
  const wideFields = fields.filter((field) => field.wide);
  const insuredMissing = !claim.insuredName?.trim() && resolveHasarInsuredName(claim) === '—';

  return (
    <div className="border-t border-slate-100">
      <div className="w-full flex items-center justify-between gap-3 px-4 py-2.5">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="min-w-0 flex-1 text-left hover:opacity-90 transition-opacity"
        >
          <p className="text-[11px] font-semibold text-slate-600">Dosya Bilgileri</p>
          {!open && subtitle && (
            <p className="text-xs text-slate-400 mt-0.5 truncate">{subtitle}</p>
          )}
        </button>
        <div className="flex items-center gap-2 shrink-0">
          {canEdit && onClaimUpdated && (
            <button
              type="button"
              onClick={() => {
                setOpen(true);
                setEditOpen(true);
              }}
              className="text-xs font-medium text-brand-600 hover:text-blue-700 px-2 py-1 rounded-lg hover:bg-blue-50"
            >
              Düzenle
            </button>
          )}
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="text-xs font-medium text-slate-500 hover:text-slate-700"
          >
            {open ? 'Gizle' : 'Detay'}
          </button>
        </div>
      </div>
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
      {editOpen && onClaimUpdated && (
        <DosyaBilgileriEditModal
          claim={claim}
          onClose={() => setEditOpen(false)}
          onSaved={(patch) => {
            onClaimUpdated(patch);
            setEditOpen(false);
          }}
        />
      )}
    </div>
  );
}
