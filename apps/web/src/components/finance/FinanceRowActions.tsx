'use client';

import { useEffect, useLayoutEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { CheckCircle2, Eye, FileText, MoreVertical, Pencil, Printer, ScrollText, Send, XCircle } from 'lucide-react';
import { formatTryAmount } from '@/utils/format-try-amount';
import { openSessionBlob } from '@/utils/pdf-preview-open';
import { PinnableRowActions } from '@/components/portal/PinnableRowActions';
import { defaultPinnedActionIds, FINANS_FATURA_ROW_ACTIONS, FINANS_FATURA_TALEP_ROW_ACTIONS, FINANS_TAHSILAT_ROW_ACTIONS } from '@/components/portal/portal-row-action-prefs';

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export async function printFinanceSlip(row: {
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
  await openSessionBlob(blob, row.title || 'Fiş');
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
  rowId,
  pinnedIds,
  onPrint,
  ekstreHref,
  onMarkPaid,
  onRequestCorrection,
}: {
  rowId?: string;
  pinnedIds?: string[];
  onPrint: () => void;
  ekstreHref?: string | null;
  onMarkPaid?: () => void;
  onRequestCorrection?: () => void;
}) {
  const uid = useId();
  const pins = pinnedIds ?? defaultPinnedActionIds(FINANS_TAHSILAT_ROW_ACTIONS);
  return (
    <PinnableRowActions
      rowId={rowId ?? uid}
      menuEvent="finans-tahsilat-menu-open"
      testId="finans-satir-islemler"
      menuTestId="finans-tahsilat-menu"
      moreTestId="finans-tahsilat-more"
      pinnedIds={pins}
      items={[
        {
          id: 'print',
          label: 'Yazdır',
          onClick: onPrint,
          icon: <Printer className="h-3.5 w-3.5" strokeWidth={1.75} />,
        },
        {
          id: 'ekstre',
          label: 'Cari Hesap Ekstresi',
          onClick: () => {
            if (ekstreHref) window.location.href = ekstreHref;
          },
          hidden: !ekstreHref,
          icon: <ScrollText className="h-3.5 w-3.5" strokeWidth={1.75} />,
        },
        {
          id: 'pay',
          label: 'Ödendi İşaretle',
          onClick: () => onMarkPaid?.(),
          hidden: !onMarkPaid,
          icon: <CheckCircle2 className="h-3.5 w-3.5" strokeWidth={1.75} />,
        },
        {
          id: 'correction',
          label: 'Düzeltme Gerekli',
          onClick: () => onRequestCorrection?.(),
          hidden: !onRequestCorrection,
          icon: <Pencil className="h-3.5 w-3.5" strokeWidth={1.75} />,
        },
      ]}
    />
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
  rowId,
  pinnedIds,
  status,
  onPrint,
  onNotifyOwner,
  onEdit,
  onCancel,
  onMarkPaid,
  onRequestCorrection,
}: {
  rowId?: string;
  pinnedIds?: string[];
  status: string;
  onPrint: () => void;
  onNotifyOwner?: () => void;
  onEdit?: () => void;
  onCancel?: () => void;
  onMarkPaid?: () => void;
  onRequestCorrection?: () => void;
}) {
  const uid = useId();
  const canPay = status === 'sent' || status === 'correction_needed';
  const frozen = status === 'paid';
  const pins = pinnedIds ?? defaultPinnedActionIds(FINANS_FATURA_ROW_ACTIONS);
  return (
    <PinnableRowActions
      rowId={rowId ?? uid}
      menuEvent="finans-fatura-menu-open"
      testId="fatura-satir-islemler"
      menuTestId="finans-fatura-menu"
      moreTestId="finans-fatura-more"
      pinnedIds={pins}
      items={[
        {
          id: 'print',
          label: 'Yazdır',
          onClick: onPrint,
          icon: <Printer className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden />,
        },
        {
          id: 'notify',
          label: 'Dosya Sorumlusuna Bildir',
          onClick: () => onNotifyOwner?.(),
          hidden: !onNotifyOwner,
          icon: <Send className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden />,
        },
        {
          id: 'edit',
          label: 'Düzenle',
          onClick: () => onEdit?.(),
          hidden: !onEdit || frozen,
          icon: <Pencil className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden />,
        },
        {
          id: 'pay',
          label: 'Ödendi',
          onClick: () => onMarkPaid?.(),
          hidden: !(canPay && onMarkPaid),
          icon: <CheckCircle2 className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden />,
        },
        {
          id: 'correction',
          label: 'Düzeltme Gerekli',
          onClick: () => onRequestCorrection?.(),
          hidden: !onRequestCorrection,
          icon: <Pencil className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden />,
        },
        {
          id: 'cancel',
          label: 'İptal Et',
          onClick: () => onCancel?.(),
          hidden: !onCancel || frozen,
          danger: true,
          icon: <XCircle className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden />,
        },
      ]}
    />
  );
}

/** Fatura talebi satırı — resmi fatura başka programda kesilir; burada bilgisi yazılır. */
export function InvoiceRequestRowActions({
  rowId,
  pinnedIds,
  status: _status,
  onInvoice,
  onView,
  onPrint,
  onNotifyOwner,
  onCancel,
}: {
  rowId?: string;
  pinnedIds?: string[];
  status: string;
  onInvoice?: () => void;
  onView: () => void;
  onPrint: () => void;
  onNotifyOwner?: () => void;
  onCancel?: () => void;
}) {
  const uid = useId();
  const pins = pinnedIds ?? defaultPinnedActionIds(FINANS_FATURA_TALEP_ROW_ACTIONS);
  return (
    <PinnableRowActions
      rowId={rowId ?? uid}
      menuEvent="finans-fatura-talep-menu-open"
      testId="fatura-talep-islemler"
      menuTestId="finans-fatura-talep-menu"
      moreTestId="finans-fatura-talep-more"
      pinnedIds={pins}
      items={[
        {
          id: 'invoice',
          label: 'Resmi Fatura Gir',
          onClick: () => onInvoice?.(),
          hidden: !onInvoice,
          testId: 'fatura-talep-fatura-kes',
          icon: <FileText className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden />,
        },
        {
          id: 'view',
          label: 'Görüntüle',
          onClick: onView,
          testId: 'fatura-talep-goruntule',
          icon: <Eye className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden />,
        },
        {
          id: 'print',
          label: 'Yazdır',
          onClick: onPrint,
          icon: <Printer className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden />,
        },
        {
          id: 'notify',
          label: 'Dosya Sorumlusuna Bildir',
          onClick: () => onNotifyOwner?.(),
          hidden: !onNotifyOwner,
          icon: <Send className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden />,
        },
        {
          id: 'cancel',
          label: 'İptal Et',
          onClick: () => onCancel?.(),
          hidden: !onCancel,
          danger: true,
          icon: <XCircle className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden />,
        },
      ]}
    />
  );
}
