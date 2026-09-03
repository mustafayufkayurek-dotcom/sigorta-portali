'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { getInvoiceRequests, type InvoiceRequest } from '@/utils/invoiceRequestApi';
import {
  INVOICE_REQUEST_TITLE_FLASH,
  dismissInvoiceRequestSession,
  isInvoiceRequestSessionDismissed,
  markInvoiceRequestsSeen,
  unseenInvoiceRequestIds,
} from '@/utils/invoice-request-alert';

export { faturaTalepleriTabPulseClass } from '@/utils/invoice-request-alert';

const TALEPLER_HREF = '/panel/finans/faturalar?tab=talepler';

export function FinansOncelikliGorevModal({ enabled }: { enabled: boolean }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, setPending] = useState<InvoiceRequest[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    const load = () => {
      getInvoiceRequests('pending')
        .then((rows) => {
          if (cancelled) return;
          const list = Array.isArray(rows) ? rows.filter((r) => r.status === 'pending') : [];
          setPending(list);
        })
        .catch(() => {
          if (!cancelled) setPending([]);
        });
    };
    load();
    const timer = window.setInterval(load, 30_000);
    const onFocus = () => load();
    window.addEventListener('focus', onFocus);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
      window.removeEventListener('focus', onFocus);
    };
  }, [enabled]);

  const pendingIds = pending.map((r) => r.id);
  const unseen = unseenInvoiceRequestIds(pendingIds);
  const onTalepler = pathname.startsWith('/panel/finans/faturalar') && searchParams.get('tab') === 'talepler';

  useEffect(() => {
    if (!enabled || pending.length === 0) {
      setOpen(false);
      return;
    }
    if (onTalepler) {
      markInvoiceRequestsSeen(pendingIds);
      setOpen(false);
      return;
    }
    if (!isInvoiceRequestSessionDismissed()) setOpen(true);
  }, [enabled, pending.length, onTalepler, pendingIds.join('|')]);

  useEffect(() => {
    if (!enabled || unseen.length === 0 || onTalepler) {
      return undefined;
    }
    const base = document.title.replace(/^(● Yeni fatura talebi(\s*[·|]\s*)?)/, '').trim() || 'Meridyen Assistance';
    let flash = false;
    const tick = () => {
      flash = !flash;
      document.title = flash ? INVOICE_REQUEST_TITLE_FLASH : base;
    };
    tick();
    const id = window.setInterval(tick, 900);
    return () => {
      window.clearInterval(id);
      document.title = base;
    };
  }, [enabled, unseen.length, onTalepler]);

  if (!enabled || !open || pending.length === 0) return null;

  return (
    <div
      className="fixed inset-0 z-[220] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Öncelikli görev"
      data-testid="finans-oncelikli-gorev"
    >
      <button
        type="button"
        className="absolute inset-0 bg-slate-950/35"
        aria-label="Kapat"
        onClick={() => {
          dismissInvoiceRequestSession();
          setOpen(false);
        }}
      />
      <div className="relative w-full max-w-md rounded-xl bg-white p-5 shadow-xl dark:bg-slate-800">
        <h2 className="text-[15px] font-medium text-slate-900 dark:text-white">Öncelikli görev</h2>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
          {pending.length} fatura talebi bekliyor. Önce Fatura Talepleri’ne bakın.
        </p>
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={() => {
              dismissInvoiceRequestSession();
              setOpen(false);
            }}
            className="rounded-lg px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-700"
          >
            Sonra
          </button>
          <button
            type="button"
            onClick={() => {
              markInvoiceRequestsSeen(pendingIds);
              dismissInvoiceRequestSession();
              setOpen(false);
              router.push(TALEPLER_HREF);
            }}
            className="rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-medium text-white"
          >
            Sayfaya git
          </button>
        </div>
      </div>
    </div>
  );
}
