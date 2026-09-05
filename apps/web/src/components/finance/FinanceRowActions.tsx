'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { CheckCircle2, Eye, MoreVertical, Pencil, Printer, ScrollText, Send, XCircle } from 'lucide-react';
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
  customer?: string;
  invoiceType?: string;
  workGroup?: string;
  date?: string;
  talepDate?: string;
  amount: number;
  status?: string;
  note?: string;
}) {
  const amount = formatTryAmount(row.amount, { fractionDigits: 0 });
  const lines: Array<[string, string]> = [
    ['Başlık', row.title || '—'],
    ['Müşteri', (row.customer || row.party || '').trim() || '—'],
    ['Dosya', row.fileNo || '—'],
  ];
  if (row.invoiceType) lines.push(['Tip', row.invoiceType]);
  if (row.workGroup) lines.push(['İş Grubu', row.workGroup]);
  lines.push(['Tarih', row.date || '—']);
  if (row.talepDate) lines.push(['Talep Tarihi', row.talepDate]);
  lines.push(['Tutar', amount]);
  lines.push(['Durum', row.status || '—']);
  if (row.note) lines.push(['Not', row.note]);
  const rowsHtml = lines
    .map(([k, v]) => `<tr><td>${escapeHtml(k)}</td><td>${escapeHtml(v)}</td></tr>`)
    .join('');
  const html = `<!doctype html><html lang="tr"><head><meta charset="utf-8"><title>${escapeHtml(row.title)}</title>
<style>
  body{font-family:ui-sans-serif,system-ui,sans-serif;padding:28px;color:#0f172a}
  h1{font-size:16px;margin:0 0 16px}
  table{width:100%;border-collapse:collapse}
  td{padding:8px 0;border-bottom:1px solid #e2e8f0;font-size:13px}
  td:first-child{color:#64748b;width:38%}
</style></head><body>
<h1>${escapeHtml(row.title)}</h1>
<table>${rowsHtml}</table>
<script>window.addEventListener('load',function(){window.focus();window.print();});</script>
</body></html>`;
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const w = window.open(url, '_blank');
  if (!w) {
    URL.revokeObjectURL(url);
    return;
  }
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
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

const iconBtn =
  'inline-flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:bg-blue-50 hover:text-blue-700';

export type FinanceKebabItem = {
  key: string;
  label: string;
  onSelect: () => void;
  danger?: boolean;
  disabled?: boolean;
};

export function FinanceKebabMenu({
  items,
  title = 'İşlemler',
  menuWidth = 280,
}: {
  items: FinanceKebabItem[];
  title?: string;
  menuWidth?: number;
}) {
  const [open, setOpen] = useState(false);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const moreBtnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const updateMenuPos = () => {
    const btn = moreBtnRef.current;
    if (!btn) return;
    const rect = btn.getBoundingClientRect();
    const left = Math.min(
      Math.max(8, rect.right - menuWidth),
      window.innerWidth - menuWidth - 8,
    );
    setMenuPos({ top: rect.bottom + 4, left });
  };

  useLayoutEffect(() => {
    if (!open) {
      setMenuPos(null);
      return;
    }
    updateMenuPos();
    const onScrollOrResize = () => updateMenuPos();
    window.addEventListener('scroll', onScrollOrResize, true);
    window.addEventListener('resize', onScrollOrResize);
    return () => {
      window.removeEventListener('scroll', onScrollOrResize, true);
      window.removeEventListener('resize', onScrollOrResize);
    };
  }, [open, menuWidth]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      const target = e.target as Node;
      if (ref.current?.contains(target)) return;
      if (menuRef.current?.contains(target)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const menu =
    open && menuPos && typeof document !== 'undefined'
      ? createPortal(
          <div
            ref={menuRef}
            className="fixed z-[120] rounded-xl border border-slate-200 bg-white py-1 text-xs shadow-lg"
            style={{ top: menuPos.top, left: menuPos.left, width: menuWidth }}
            role="menu"
          >
            {items.map((item) => (
              <button
                key={item.key}
                type="button"
                role="menuitem"
                disabled={item.disabled}
                className={`w-full px-3 py-2 text-left disabled:opacity-40 ${
                  item.danger
                    ? 'text-status-danger hover:bg-red-50'
                    : 'text-slate-700 hover:bg-slate-50'
                }`}
                onClick={() => {
                  setOpen(false);
                  item.onSelect();
                }}
              >
                {item.label}
              </button>
            ))}
          </div>,
          document.body,
        )
      : null;

  return (
    <div ref={ref} className="relative inline-flex" onClick={(e) => e.stopPropagation()}>
      <button
        ref={moreBtnRef}
        type="button"
        title={title}
        aria-label={title}
        aria-haspopup="menu"
        aria-expanded={open}
        className={iconBtn}
        onClick={() => setOpen((v) => !v)}
      >
        <MoreVertical className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden />
      </button>
      {menu}
    </div>
  );
}

/** Kesilen fatura satırı — İşlemler ikonları. */
export function InvoiceRowActions({
  status,
  onPrint,
  onNotifyOwner,
  onEdit,
  onCancel,
  onMarkPaid,
}: {
  status: string;
  onPrint: () => void;
  onNotifyOwner?: () => void;
  onEdit?: () => void;
  onCancel?: () => void;
  onMarkPaid?: () => void;
}) {
  const canPay = status === 'sent';
  return (
    <div className="flex items-center justify-end gap-0.5" data-testid="fatura-satir-islemler">
      <button type="button" title="Yazdır" aria-label="Yazdır" onClick={onPrint} className={iconBtn}>
        <Printer className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden />
      </button>
      {onNotifyOwner ? (
        <button type="button" title="Dosya sorumlusuna bildir" aria-label="Dosya sorumlusuna bildir" onClick={onNotifyOwner} className={iconBtn}>
          <Send className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden />
        </button>
      ) : null}
      {onEdit ? (
        <button type="button" title="Düzenle" aria-label="Düzenle" onClick={onEdit} className={iconBtn}>
          <Pencil className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden />
        </button>
      ) : null}
      {canPay && onMarkPaid ? (
        <button type="button" title="Ödendi" aria-label="Ödendi" onClick={onMarkPaid} className={iconBtn}>
          <CheckCircle2 className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden />
        </button>
      ) : null}
      {onCancel ? (
        <button type="button" title="İptal et" aria-label="İptal et" onClick={onCancel} className={`${iconBtn} hover:bg-red-50 hover:text-status-danger`}>
          <XCircle className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden />
        </button>
      ) : null}
    </div>
  );
}

/** Fatura talebi satırı — Kesilen Faturalar ile aynı işlem ikonları. */
export function InvoiceRequestRowActions({
  status: _status,
  onView,
  onPrint,
  onNotifyOwner,
  onEdit,
  onCancel,
}: {
  status: string;
  onView: () => void;
  onPrint: () => void;
  onNotifyOwner?: () => void;
  onEdit?: () => void;
  onCancel?: () => void;
}) {
  return (
    <div className="flex items-center justify-end gap-0.5" data-testid="fatura-talep-islemler">
      <button type="button" title="Görüntüle" aria-label="Görüntüle" onClick={onView} className={iconBtn} data-testid="fatura-talep-goruntule">
        <Eye className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden />
      </button>
      <button type="button" title="Yazdır" aria-label="Yazdır" onClick={onPrint} className={iconBtn}>
        <Printer className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden />
      </button>
      {onNotifyOwner ? (
        <button type="button" title="Dosya sorumlusuna bildir" aria-label="Dosya sorumlusuna bildir" onClick={onNotifyOwner} className={iconBtn}>
          <Send className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden />
        </button>
      ) : null}
      {onEdit ? (
        <button type="button" title="Düzenle" aria-label="Düzenle" onClick={onEdit} className={iconBtn}>
          <Pencil className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden />
        </button>
      ) : null}
      {onCancel ? (
        <button type="button" title="İptal et" aria-label="İptal et" onClick={onCancel} className={`${iconBtn} hover:bg-red-50 hover:text-status-danger`}>
          <XCircle className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden />
        </button>
      ) : null}
    </div>
  );
}
