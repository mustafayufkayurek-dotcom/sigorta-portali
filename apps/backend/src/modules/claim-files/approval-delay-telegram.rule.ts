/**
 * Onay gecikmesi — Telegram + panel (dosya sorumlusu + admin).
 * Eşik: dashboard ile aynı (≥24s / ≥48s). Telegram yalnız ≥48s kritik.
 * Format: dosya no + müşteri kısa ad; Etki yok; çokluysa 1- 2- 3- liste.
 */

import { formatMeridyenTelegramMessage } from './inspection-telegram-reminder.rule';

export const APPROVAL_DELAY_WARNING_HOURS = 24;
export const APPROVAL_DELAY_CRITICAL_HOURS = 48;
export const APPROVAL_DELAY_TELEGRAM_NOTIFY_TYPE = 'approval_delay_telegram';

export type ApprovalDelayTelegramRow = {
  claimFileId?: string | null;
  fileNo?: string | null;
  customerShortName?: string | null;
  hoursWaiting: number;
  category?: 'pending_approval' | 'external_approval' | 'submitted' | string;
  assignedOfficeUserId?: string | null;
  currentResponsibleUserId?: string | null;
};

export type ApprovalDelayCriticalItem = {
  claimFileId: string;
  fileNo: string;
  customerShortName: string;
  hoursWaiting: number;
  assignedOfficeUserId: string | null;
  currentResponsibleUserId: string | null;
};

export type ApprovalDelayTelegramDigest = {
  total24h: number;
  critical48h: number;
  pendingApproval: number;
  externalApproval: number;
  submitted: number;
  /** Kritik dosyalar (Telegram Konu listesi) */
  criticalItems: ApprovalDelayCriticalItem[];
};

export type ApprovalDelayTelegramPayload = {
  severity: 'CRITICAL' | 'WARNING';
  code: string;
  title: string;
  detail: string;
  impact: string;
  action: string;
  text: string;
};

const LIST_LIMIT = 10;

/** Müşteri kısa ad — shortName öncelikli */
export function resolveApprovalCustomerShortName(input: {
  shortName?: string | null;
  companyName?: string | null;
  fullName?: string | null;
}): string {
  const short = (input.shortName ?? '').trim();
  if (short) return short;
  const company = (input.companyName ?? '').trim();
  if (company) return company;
  const full = (input.fullName ?? '').trim();
  if (full) return full;
  return 'Müşteri';
}

export function formatApprovalDelayKonuLine(fileNo: string, customerShortName: string): string {
  const no = (fileNo ?? '').trim() || '—';
  const name = (customerShortName ?? '').trim() || 'Müşteri';
  return `${no} Nolu ${name} dosya onayı gecikti.`;
}

/** ≥24s satırlarından özet (dosya başına en uzun bekleme önceden seçilmiş olmalı) */
export function buildApprovalDelayTelegramDigest(
  rows: ApprovalDelayTelegramRow[],
): ApprovalDelayTelegramDigest {
  const overdue = rows
    .filter((r) => Number.isFinite(r.hoursWaiting) && r.hoursWaiting >= APPROVAL_DELAY_WARNING_HOURS)
    .sort((a, b) => b.hoursWaiting - a.hoursWaiting);

  const critical = overdue.filter((r) => r.hoursWaiting >= APPROVAL_DELAY_CRITICAL_HOURS);
  const criticalItems: ApprovalDelayCriticalItem[] = [];
  for (const r of critical) {
    if (criticalItems.length >= LIST_LIMIT) break;
    const fileNo = (r.fileNo ?? '').trim();
    if (!fileNo) continue;
    criticalItems.push({
      claimFileId: (r.claimFileId ?? '').trim(),
      fileNo,
      customerShortName: (r.customerShortName ?? '').trim() || 'Müşteri',
      hoursWaiting: r.hoursWaiting,
      assignedOfficeUserId: r.assignedOfficeUserId ?? null,
      currentResponsibleUserId: r.currentResponsibleUserId ?? null,
    });
  }

  return {
    total24h: overdue.length,
    critical48h: critical.length,
    pendingApproval: overdue.filter((r) => r.category === 'pending_approval').length,
    externalApproval: overdue.filter((r) => r.category === 'external_approval').length,
    submitted: overdue.filter((r) => r.category === 'submitted').length,
    criticalItems,
  };
}

/** Hedef: hasar dosya sorumlusu + admin (saha tespitçi yok) */
export function resolveApprovalDelayNotifyUserIds(
  item: Pick<ApprovalDelayCriticalItem, 'assignedOfficeUserId' | 'currentResponsibleUserId'>,
  adminIds: string[],
): string[] {
  const ids = new Set<string>();
  if (item.assignedOfficeUserId) ids.add(item.assignedOfficeUserId);
  if (item.currentResponsibleUserId) ids.add(item.currentResponsibleUserId);
  for (const a of adminIds) ids.add(a);
  return [...ids];
}

export function buildApprovalDelayTelegramPayload(
  digest: ApprovalDelayTelegramDigest,
  opts?: { at?: Date; host?: string },
): ApprovalDelayTelegramPayload | null {
  if (digest.criticalItems.length <= 0) return null;

  const items = digest.criticalItems;
  const severity: 'CRITICAL' | 'WARNING' = 'CRITICAL';
  const code = 'APPROVAL_DELAY_48H';

  const title =
    items.length === 1
      ? formatApprovalDelayKonuLine(items[0].fileNo, items[0].customerShortName)
      : items
          .map((it, i) => `${i + 1}- ${formatApprovalDelayKonuLine(it.fileNo, it.customerShortName)}`)
          .join('\n');

  const action =
    items.length === 1
      ? 'Lütfen müşteri ile irtibata geçiniz.'
      : 'Lütfen müşteriler ile irtibata geçiniz.';

  const detail = '';
  const impact = '';

  const text = formatMeridyenTelegramMessage({
    severity,
    code,
    title,
    detail,
    impact,
    action,
    at: opts?.at,
    host: opts?.host,
    channelLabel: 'ONAY GECİKMESİ',
    includeCode: false,
    includeHost: false,
    includeImpact: false,
    includeDetail: false,
    boldLabels: true,
    timeStyle: 'human',
  });

  return { severity, code, title, detail, impact, action, text };
}
