/**
 * Fatura talebi — Telegram + panel (admin + finans).
 * Onay gecikmesi ile aynı kabuk: Konu tekli/listeli, Etki/Durum/Kod/Sunucu yok.
 */

import { formatMeridyenTelegramMessage } from '@/modules/claim-files/inspection-telegram-reminder.rule';

export const INVOICE_REQUEST_TELEGRAM_NOTIFY_TYPE = 'invoice_request_telegram';

export type InvoiceRequestTelegramItem = {
  invoiceRequestId?: string | null;
  fileNo: string;
  customerShortName: string;
  /** Dosya bedeli (KDV ifadesi satır sonunda) */
  totalAmount: number;
};

export type InvoiceRequestTelegramPayload = {
  severity: 'WARNING' | 'INFO';
  code: string;
  title: string;
  detail: string;
  impact: string;
  action: string;
  text: string;
};

const LIST_LIMIT = 10;

export function formatInvoiceAmountTr(amount: number): string {
  const n = Number.isFinite(amount) ? amount : 0;
  return `${n.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} TL KDV`;
}

export function resolveInvoiceCustomerShortName(input: {
  shortName?: string | null;
  companyName?: string | null;
  fullName?: string | null;
  insuranceCompanyName?: string | null;
}): string {
  const short = (input.shortName ?? '').trim();
  if (short) return short;
  const company = (input.companyName ?? '').trim();
  if (company) return company;
  const full = (input.fullName ?? '').trim();
  if (full) return full;
  const insurance = (input.insuranceCompanyName ?? '').trim();
  if (insurance) return insurance;
  return 'Müşteri';
}

/** Örn: HS-1001 Nolu Acme fatura talebi. Dosya bedeli: 12.500,00 TL KDV. */
export function formatInvoiceRequestKonuLine(item: InvoiceRequestTelegramItem): string {
  const no = (item.fileNo ?? '').trim() || '—';
  const name = (item.customerShortName ?? '').trim() || 'Müşteri';
  return `${no} Nolu ${name} fatura talebi. Dosya bedeli: ${formatInvoiceAmountTr(item.totalAmount)}.`;
}

export const INVOICE_REQUEST_TELEGRAM_ACTION =
  'Lütfen belirtilen dosya faturalarını düzenleyip ilgili dosya sorumlularına iletiniz.';

export function buildInvoiceRequestTelegramPayload(
  items: InvoiceRequestTelegramItem[],
  opts?: { at?: Date; host?: string },
): InvoiceRequestTelegramPayload | null {
  const list = items
    .filter((it) => (it.fileNo ?? '').trim())
    .slice(0, LIST_LIMIT);
  if (list.length === 0) return null;

  const title =
    list.length === 1
      ? formatInvoiceRequestKonuLine(list[0])
      : list.map((it, i) => `${i + 1}- ${formatInvoiceRequestKonuLine(it)}`).join('\n');

  const severity: 'WARNING' | 'INFO' = 'WARNING';
  const code = 'INVOICE_REQUEST_PENDING';
  const action = INVOICE_REQUEST_TELEGRAM_ACTION;

  const text = formatMeridyenTelegramMessage({
    severity,
    code,
    title,
    detail: '',
    impact: '',
    action,
    at: opts?.at,
    host: opts?.host,
    channelLabel: 'FATURA TALEBİ',
    includeCode: false,
    includeHost: false,
    includeImpact: false,
    includeDetail: false,
    boldLabels: true,
    timeStyle: 'human',
  });

  return { severity, code, title, detail: '', impact: '', action, text };
}

/** Hedef: admin + finans personeli */
export function isInvoiceRequestNotifyRole(code: string | null | undefined): boolean {
  const c = (code ?? '').trim().toLowerCase();
  return (
    c === 'admin' ||
    c === 'finance' ||
    c === 'finans' ||
    c === 'accountant'
  );
}
