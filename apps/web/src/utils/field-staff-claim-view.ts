/**
 * Saha tespitçisi (field_staff) görünürlük sözleşmesi.
 * Liste/detay: sigortalı adı · adres · iletişim · tespit durumu (+ tarih saat).
 * Finans / sigorta / planlayıcı UI’da yok.
 */

import { formatHasarAdresi } from '@/utils/text-helpers';
import { resolveHasarInsuredName } from '@/utils/claim-insured-display';

export type FieldStaffClaimLite = {
  insuredName?: string | null;
  insuredPhone?: string | null;
  propertyAddress?: {
    addressLine?: string | null;
    neighborhood?: string | null;
    district?: string | null;
    city?: string | null;
  } | null;
  customer?: { firstName?: string | null; lastName?: string | null; fullName?: string | null } | null;
  inspectionDone?: boolean | null;
  inspectionDoneAt?: string | null;
  currentStatus?: { code?: string | null; name?: string | null } | null;
  statusChangedAt?: string | null;
};

export function fieldStaffInsuredName(claim: FieldStaffClaimLite): string {
  return resolveHasarInsuredName(claim);
}

export function fieldStaffPhone(claim: FieldStaffClaimLite): string {
  const phone = typeof claim.insuredPhone === 'string' ? claim.insuredPhone.trim() : '';
  return phone;
}

export function fieldStaffAddress(claim: FieldStaffClaimLite): string {
  return formatHasarAdresi(claim.propertyAddress);
}

export type FieldStaffInspectionStatus = {
  done: boolean;
  label: 'Tespit Yapıldı' | 'Tespit Yapılmadı';
  doneAtLabel: string;
};

function formatInspectionDateTime(iso: string | null | undefined): string {
  if (!iso?.trim()) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('tr-TR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** Liste/detay — Tespit Yapıldı / Yapılmadı + tarih saat */
export function fieldStaffInspectionStatus(claim: FieldStaffClaimLite): FieldStaffInspectionStatus {
  const code = (claim.currentStatus?.code ?? '').toUpperCase();
  const statusDone = code === 'INSPECTION_DONE';
  const done = Boolean(claim.inspectionDone) || statusDone;
  const doneAt =
    claim.inspectionDoneAt
    ?? (statusDone ? claim.statusChangedAt ?? null : null);
  return {
    done,
    label: done ? 'Tespit Yapıldı' : 'Tespit Yapılmadı',
    doneAtLabel: done ? formatInspectionDateTime(doneAt) : '—',
  };
}

/** Aktif liste: tespit bekleyen. Tespiti yapılanlar ayrı karta gider. */
export function fieldStaffAssignedListSplit<T extends FieldStaffClaimLite>(claims: T[]): {
  pendingInspection: T[];
  inspectionDone: T[];
} {
  const pendingInspection: T[] = [];
  const inspectionDone: T[] = [];
  for (const c of claims) {
    if (fieldStaffInspectionStatus(c).done) inspectionDone.push(c);
    else pendingInspection.push(c);
  }
  return { pendingInspection, inspectionDone };
}

export const FIELD_STAFF_COMPLETED_INSPECTIONS_HREF = '/panel/saha/tespiti-tamamlananlar';
export const FIELD_STAFF_COMPLETED_INSPECTIONS_LABEL = 'Tamamlanan Tespitler';
export const FIELD_STAFF_ASSIGNMENTS_LABEL = 'Atanan Dosyalar';

/** Tespit işlemi biten dosyalar — açık + kapalı, tekilleştirilmiş, yeni tamamlanan üstte. */
export function fieldStaffCompletedInspectionFiles<T extends FieldStaffClaimLite & { id: string }>(
  groups: T[][],
): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const group of groups) {
    for (const claim of group) {
      if (!claim?.id || seen.has(claim.id)) continue;
      if (!fieldStaffInspectionStatus(claim).done) continue;
      seen.add(claim.id);
      out.push(claim);
    }
  }
  out.sort((a, b) => {
    const ta = new Date(a.inspectionDoneAt ?? a.statusChangedAt ?? 0).getTime();
    const tb = new Date(b.inspectionDoneAt ?? b.statusChangedAt ?? 0).getTime();
    return tb - ta;
  });
  return out;
}

/**
 * Rozet renkleri — Yapılmadı belirgin ama yumuşak (yormayan uyarı).
 * Yapıldı: sakin başarı tonu.
 */
export function fieldStaffInspectionBadgeClass(done: boolean): string {
  if (done) {
    return 'bg-status-success/20 text-status-success ring-1 ring-status-success/45';
  }
  return 'bg-amber-100 text-amber-950 ring-1 ring-amber-300/80';
}

const MS_HOUR = 60 * 60 * 1000;

export type InspectionReminderAudience = 'field' | 'office';

export type InspectionReminderResult = {
  pendingCount: number;
  overdue48Count: number;
  message: string;
};

type ReminderClaim = FieldStaffClaimLite & {
  id?: string;
  createdAt?: string | null;
  updatedAt?: string | null;
};

/**
 * Tespit uyarı bandı — saha + ofis aynı sayım; metin audience’a göre.
 * channel: yalnız dashboard amber band (çan / WhatsApp değil).
 */
export function inspectionReminder(
  claims: ReminderClaim[],
  audience: InspectionReminderAudience = 'field',
): InspectionReminderResult {
  const now = Date.now();
  let pendingCount = 0;
  let overdue48Count = 0;
  for (const c of claims) {
    if (fieldStaffInspectionStatus(c).done) continue;
    pendingCount += 1;
    const start = c.createdAt ?? c.updatedAt;
    if (!start) continue;
    const t = new Date(start).getTime();
    if (!Number.isNaN(t) && now - t >= 48 * MS_HOUR) overdue48Count += 1;
  }
  if (pendingCount === 0) {
    return { pendingCount: 0, overdue48Count: 0, message: '' };
  }
  const base =
    audience === 'office'
      ? pendingCount === 1
        ? '1 dosyada tespit henüz yapılmadı'
        : `${pendingCount} dosyada tespit henüz yapılmadı`
      : pendingCount === 1
        ? '1 dosyada tespit bekleniyor'
        : `${pendingCount} dosyada tespit bekleniyor`;
  const late = overdue48Count > 0
    ? overdue48Count === 1
      ? ' · 1 dosya 48 saati aştı'
      : ` · ${overdue48Count} dosya 48 saati aştı`
    : '';
  return { pendingCount, overdue48Count, message: `${base}${late}.` };
}

/** Saha Merkezi — `inspectionReminder(..., 'field')` alias */
export function fieldStaffInspectionReminder(claims: ReminderClaim[]): InspectionReminderResult {
  return inspectionReminder(claims, 'field');
}

/**
 * Saha ofis sekmelerini görmez (ziyaret kartı + tespit foto/not).
 * Finans / Operasyon / Raporlar / Genel Bilgiler gizlidir.
 * Tespit fotoğrafları ve notları ayrı saha bölümünde gösterilir.
 */
export const FIELD_STAFF_HIDDEN_CLAIM_TABS = [
  'finans',
  'operasyon',
  'raporlar',
  'genel-bilgiler',
] as const;

/** Yol tarifi — adres metninden (harici sağlayıcı adı UI’da yok) */
export function fieldStaffDirectionsUrl(address: string): string | null {
  const q = address.trim();
  if (!q || q === '—') return null;
  return `https://maps.google.com/?q=${encodeURIComponent(q)}`;
}
