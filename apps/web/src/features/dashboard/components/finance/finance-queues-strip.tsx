'use client';

import Link from 'next/link';
import { ArrowRight, ArrowUpRight, FileText } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { useApiQuery } from '@/hooks/useApi';
import { API, authHeader } from '@/utils/api';
import { formatCurrency } from '../../utils/formatters';
import { unwrapApiData } from '@/utils/invoice-request-envelope';
import type { InvoiceDashboardSummary } from '@/utils/invoiceRequestApi';

type PaymentSummary = {
  pendingOutgoing?: number;
  pendingOutgoingCount?: number;
  dueOutgoing?: number;
  dueOutgoingCount?: number;
  pendingIncoming?: number;
  pendingIncomingCount?: number;
};

export function FinanceQueuesStrip() {
  const invoiceQuery = useApiQuery<InvoiceDashboardSummary>(
    ['finance-invoice-dashboard'],
    '/invoice-requests/dashboard',
  );
  const paymentsQuery = useQuery({
    queryKey: ['finance-payment-summary'],
    queryFn: async (): Promise<PaymentSummary> => {
      const r = await axios.get(`${API}/payments`, {
        headers: authHeader(),
        params: { page: 1, limit: 1 },
      });
      return r.data.summary ?? {};
    },
  });

  const inv = unwrapApiData<InvoiceDashboardSummary | undefined>(invoiceQuery.data);
  const pay = paymentsQuery.data;
  const pendingTalep = inv?.counts?.pendingCount ?? 0;
  const approvedTalep = inv?.counts?.approvedCount ?? 0;
  const pendingTalepAmount = inv?.amounts?.pendingAmount ?? 0;
  const approvedTalepAmount = inv?.amounts?.approvedAmount ?? 0;
  const payableCount = pay?.pendingOutgoingCount ?? 0;
  const payableAmount = pay?.pendingOutgoing ?? 0;
  const duePayableCount = pay?.dueOutgoingCount ?? 0;

  return (
    <section
      data-testid="finans-is-kuyruklari"
      className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900"
    >
      <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-base font-semibold text-slate-950 dark:text-white">Finans İş Kuyrukları</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Kapanan dosyalardan gelen satış fatura talepleri ve biriken tedarikçi / avans ödemeleri.
          </p>
        </div>
        {(invoiceQuery.isFetching || paymentsQuery.isFetching) && (
          <span className="text-xs font-medium text-slate-400">Güncelleniyor</span>
        )}
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <Link
          href="/panel/finans/faturalar?tab=talepler"
          data-testid="finans-fatura-talepleri-kuyruk"
          className="group flex min-h-[140px] flex-col justify-between rounded-lg border border-indigo-200 bg-indigo-50/40 p-4 transition-colors hover:border-indigo-300 hover:bg-indigo-50 dark:border-indigo-900/50 dark:bg-indigo-950/20 dark:hover:bg-indigo-950/40"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="rounded-md bg-indigo-100 p-2 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300">
                <FileText className="h-5 w-5" />
              </span>
              <div>
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Satış Fatura Talepleri</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">Hasar, acil yardım ve özel müşteri kapanışları</p>
              </div>
            </div>
            <ArrowRight className="h-4 w-4 shrink-0 text-slate-300 transition-transform group-hover:translate-x-0.5 group-hover:text-indigo-500" />
          </div>
          {invoiceQuery.isLoading ? (
            <div className="mt-4 h-16 animate-pulse rounded-md bg-indigo-100/80 dark:bg-indigo-900/30" />
          ) : invoiceQuery.isError ? (
            <p className="mt-4 text-sm text-rose-700 dark:text-rose-300">Fatura Talepleri Yüklenemedi</p>
          ) : (
            <div className="mt-4 grid grid-cols-2 gap-3">
              <div>
                <p className="text-xs text-slate-500">Onay Bekleyen</p>
                <p className="text-xl font-semibold text-slate-950 dark:text-white">{pendingTalep}</p>
                <p className="text-xs text-slate-400">{formatCurrency(pendingTalepAmount)}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Kesilecek (Onaylı)</p>
                <p className="text-xl font-semibold text-indigo-700 dark:text-indigo-300">{approvedTalep}</p>
                <p className="text-xs text-slate-400">{formatCurrency(approvedTalepAmount)}</p>
              </div>
            </div>
          )}
        </Link>

        <Link
          href="/panel/finans/tahsilatlar?queue=payable"
          className="group flex min-h-[140px] flex-col justify-between rounded-lg border border-rose-200 bg-rose-50/40 p-4 transition-colors hover:border-rose-300 hover:bg-rose-50 dark:border-rose-900/50 dark:bg-rose-950/20 dark:hover:bg-rose-950/40"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="rounded-md bg-rose-100 p-2 text-rose-700 dark:bg-rose-900/50 dark:text-rose-300">
                <ArrowUpRight className="h-5 w-5" />
              </span>
              <div>
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Tedarikçi Ödeme Kuyruğu</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">Hakediş, avans ve kapanan dosya ödemeleri</p>
              </div>
            </div>
            <ArrowRight className="h-4 w-4 shrink-0 text-slate-300 transition-transform group-hover:translate-x-0.5 group-hover:text-rose-500" />
          </div>
          {paymentsQuery.isLoading ? (
            <div className="mt-4 h-16 animate-pulse rounded-md bg-rose-100/80 dark:bg-rose-900/30" />
          ) : paymentsQuery.isError ? (
            <p className="mt-4 text-sm text-rose-700 dark:text-rose-300">Ödeme Kuyruğu Yüklenemedi</p>
          ) : (
            <div className="mt-4 grid grid-cols-2 gap-3">
              <div>
                <p className="text-xs text-slate-500">Bekleyen Ödeme</p>
                <p className="text-xl font-semibold text-slate-950 dark:text-white">{payableCount}</p>
                <p className="text-xs text-slate-400">{formatCurrency(payableAmount)}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Vadesi Gelen</p>
                <p className="text-xl font-semibold text-rose-700 dark:text-rose-300">{duePayableCount}</p>
                <p className="text-xs text-slate-400">Acil ödeme takibi</p>
              </div>
            </div>
          )}
        </Link>
      </div>
    </section>
  );
}
