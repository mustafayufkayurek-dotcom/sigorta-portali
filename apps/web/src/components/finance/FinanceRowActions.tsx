'use client';

import { CheckCircle2, Printer, ScrollText } from 'lucide-react';
import { formatTryAmount } from '@/utils/format-try-amount';

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function printFinanceSlip(row: {
  title: string;
  fileNo?: string;
  party?: string;
  workGroup?: string;
  date?: string;
  talepDate?: string;
  amount: number;
  status?: string;
  note?: string;
}) {
  const w = window.open('', '_blank', 'noopener,noreferrer');
  if (!w) return;
  const amount = formatTryAmount(row.amount, { fractionDigits: 0 });
  w.document.write(`<!doctype html><html lang="tr"><head><meta charset="utf-8"><title>${escapeHtml(row.title)}</title>
<style>
  body{font-family:ui-sans-serif,system-ui,sans-serif;padding:28px;color:#0f172a}
  h1{font-size:16px;margin:0 0 16px}
  table{width:100%;border-collapse:collapse}
  td{padding:8px 0;border-bottom:1px solid #e2e8f0;font-size:13px}
  td:first-child{color:#64748b;width:38%}
</style></head><body>
<h1>${escapeHtml(row.title)}</h1>
<table>
<tr><td>Dosya</td><td>${escapeHtml(row.fileNo || '—')}</td></tr>
<tr><td>Tedarikçi Adı Soyadı</td><td>${escapeHtml(row.party || '—')}</td></tr>
<tr><td>İş Grubu</td><td>${escapeHtml(row.workGroup || '—')}</td></tr>
<tr><td>Ödeme Tarihi</td><td>${escapeHtml(row.date || '—')}</td></tr>
<tr><td>Hakediş Talep Tarihi</td><td>${escapeHtml(row.talepDate || '—')}</td></tr>
<tr><td>Tutar</td><td>${escapeHtml(amount)}</td></tr>
<tr><td>Durum</td><td>${escapeHtml(row.status || '—')}</td></tr>
<tr><td>Not</td><td>${escapeHtml(row.note || '—')}</td></tr>
</table>
<script>window.onload=function(){window.print();}</script>
</body></html>`);
  w.document.close();
}

export function vendorEkstreHref(source: {
  vendorId?: string | null;
  statementId?: string | null;
  fromFile?: string | null;
  fileNo?: string | null;
  returnTo?: string | null;
}): string | null {
  if (!source.vendorId) return null;
  const base = source.statementId
    ? `/panel/tedarikciler/${source.vendorId}/ekstreler/${source.statementId}`
    : `/panel/tedarikciler/${source.vendorId}`;
  const q = new URLSearchParams();
  if (source.fromFile) q.set('fromFile', source.fromFile);
  if (source.fileNo) q.set('fileNo', source.fileNo);
  if (source.returnTo) q.set('returnTo', source.returnTo);
  const qs = q.toString();
  return qs ? `${base}?${qs}` : base;
}

export function FinanceRowActions({
  onPrint,
  ekstreHref,
  onMarkPaid,
}: {
  onPrint: () => void;
  ekstreHref?: string | null;
  onMarkPaid?: () => void;
}) {
  return (
    <div className="flex items-center justify-end gap-0.5" data-testid="finans-satir-islemler">
      <button
        type="button"
        title="Yazdır"
        onClick={onPrint}
        className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:bg-blue-50 hover:text-blue-700"
      >
        <Printer className="h-3.5 w-3.5" strokeWidth={1.75} />
      </button>
      {ekstreHref ? (
        <a
          href={ekstreHref}
          title="Cari Hesap Ekstresi"
          className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:bg-blue-50 hover:text-blue-700"
        >
          <ScrollText className="h-3.5 w-3.5" strokeWidth={1.75} />
        </a>
      ) : null}
      {onMarkPaid ? (
        <button
          type="button"
          title="Ödendi İşaretle"
          onClick={onMarkPaid}
          className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-emerald-500 hover:bg-emerald-50 hover:text-emerald-700"
        >
          <CheckCircle2 className="h-3.5 w-3.5" strokeWidth={1.75} />
        </button>
      ) : null}
    </div>
  );
}
