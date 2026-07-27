'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import PortalPageHeader from '@/components/portal/PortalPageHeader';
import {
  usePanelTableColumns,
  TableColumnsProvider,
  PanelTableColumnPicker,
  PanelTableTh,
  PanelTableTd,
  PanelTableFrame,
  panelTableLayoutStyle,
  type TableColumnDef,
} from '@/components/ui/TableColumnPicker';
import { fmtDate } from '@/utils/date-helpers';
import { fetchPortalInvoices, hasPortalSessionToken } from '@/utils/portal-api';
import { hasInsuranceCompanyUserAccess, readInsurancePortalUser } from '@/utils/portal-insurance-scope';

const SIGORTA_INVOICE_TABLE_COLUMNS: TableColumnDef[] = [
  { id: 'invoiceNo', label: 'Fatura No', defaultWidth: 120, minWidth: 96 },
  { id: 'invoiceDate', label: 'Düzenleme', defaultWidth: 104, minWidth: 88 },
  { id: 'dueDate', label: 'Vade', defaultWidth: 104, minWidth: 88 },
  { id: 'totalAmount', label: 'Tutar', defaultWidth: 108, minWidth: 88 },
  { id: 'status', label: 'Durum', defaultWidth: 108, minWidth: 88 },
];

interface Invoice {
  id: string;
  invoiceNo: string;
  invoiceDate: string;
  dueDate?: string | null;
  totalAmount: number;
  status: string;
  claimFile?: { fileNo?: string; id?: string };
}

export default function SigortaFaturalarPage() {
  const router = useRouter();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [missingScope, setMissingScope] = useState(false);
  const tableColumns = usePanelTableColumns('table-cols:sigorta-portal-faturalar', SIGORTA_INVOICE_TABLE_COLUMNS);

  useEffect(() => {
    const { user, hasScope } = readInsurancePortalUser();
    if (!user) { router.push('/giris'); return; }
    if (!hasInsuranceCompanyUserAccess(user)) { router.push('/panel'); return; }
    if (!hasScope) {
      setMissingScope(true);
      setLoading(false);
      return;
    }

    setError(null);
    if (!hasPortalSessionToken()) {
      router.push('/giris');
      return;
    }
    fetchPortalInvoices(50)
      .then((res) => {
        setInvoices((res?.data ?? []) as Invoice[]);
        setTotal(res?.meta?.total ?? 0);
      })
      .catch((err: Error) => {
        if (err.message === 'SESSION_REQUIRED') {
          router.push('/giris');
          return;
        }
        setError(err.message ?? 'Faturalar yüklenemedi.');
      })
      .finally(() => setLoading(false));
  }, [router]);

  const fmtMoney = (v: number) => v.toLocaleString('tr-TR', { style: 'currency', currency: 'TRY' });

  const statusLabel = (s: string) => {
    const map: Record<string, string> = { draft: 'Taslak', sent: 'Gönderildi', paid: 'Ödendi', overdue: 'Gecikmiş', cancelled: 'İptal', partial: 'Kısmi Ödeme' };
    return map[s] ?? s;
  };
  const statusColor = (s: string) => {
    const map: Record<string, string> = {
      draft: 'bg-slate-100 text-slate-600',
      sent: 'bg-blue-100 text-blue-700',
      paid: 'bg-green-100 text-green-700',
      overdue: 'bg-red-100 text-red-700',
      cancelled: 'bg-slate-100 text-slate-500',
      partial: 'bg-yellow-100 text-yellow-800',
    };
    return map[s] ?? 'bg-slate-100 text-slate-600';
  };

  if (loading) return <div className="flex items-center justify-center h-64 text-slate-500">Yükleniyor...</div>;

  const totalPaid = invoices.filter((i) => i.status === 'paid').reduce((s, i) => s + i.totalAmount, 0);
  const totalPending = invoices.filter((i) => i.status === 'sent' || i.status === 'overdue').reduce((s, i) => s + i.totalAmount, 0);

  return (
    <div className="min-w-0 max-w-full space-y-4">
      <PortalPageHeader
        portalHomeHref="/panel/sigorta-portal"
        portalHomeLabel="Sigorta Portal"
        currentLabel="Faturalar"
        title="Faturalar"
        actions={
          <span className="w-fit shrink-0 rounded-full bg-purple-100 px-3 py-1 text-sm font-medium text-purple-800">
            {total} fatura
          </span>
        }
      />

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 flex justify-between items-center">
          <span>{error}</span>
          <button type="button" onClick={() => setError(null)} className="text-red-700 hover:text-red-900 ml-4 font-bold">&times;</button>
        </div>
      )}

      {missingScope ? (
        <div className="bg-white rounded-xl border border-amber-200 py-16 text-center px-6">
          <p className="text-slate-700 font-medium">Sigorta şirketi kapsamı tanımlı değil.</p>
          <p className="text-slate-500 text-sm mt-2">Fatura listesi için hesabınıza sigorta şirketi atanmalıdır.</p>
        </div>
      ) : (
        <>
          {invoices.length > 0 && (
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white rounded-xl border border-slate-200 p-4">
                <p className="text-xs text-slate-500 mb-1">Ödenen Toplam</p>
                <p className="text-lg font-bold text-green-600">{fmtMoney(totalPaid)}</p>
              </div>
              <div className="bg-white rounded-xl border border-slate-200 p-4">
                <p className="text-xs text-slate-500 mb-1">Bekleyen Toplam</p>
                <p className="text-lg font-bold text-orange-600">{fmtMoney(totalPending)}</p>
              </div>
            </div>
          )}

          {!error && invoices.length === 0 ? (
            <div className="bg-white rounded-xl border border-slate-200 py-16 text-center">
              <p className="text-slate-500">Fatura bulunamadı.</p>
            </div>
          ) : (
            <>
              <div className="space-y-2 md:hidden">
                {invoices.map((inv) => (
                  <div key={inv.id} className="rounded-xl border border-slate-200 bg-white p-4">
                    <div className="flex min-w-0 items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-slate-900">{inv.invoiceNo ?? '—'}</p>
                        <p className="mt-1 text-xs text-slate-500">Düzenleme: {fmtDate(inv.invoiceDate)}</p>
                        {inv.dueDate ? (
                          <p className="text-xs text-slate-500">Vade: {fmtDate(inv.dueDate)}</p>
                        ) : null}
                        <p className="mt-1 text-sm font-medium text-slate-900">{fmtMoney(inv.totalAmount)}</p>
                      </div>
                      <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${statusColor(inv.status)}`}>
                        {statusLabel(inv.status)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
              <TableColumnsProvider value={tableColumns}>
                <PanelTableFrame
                  className="hidden md:block"
                  toolbar={<PanelTableColumnPicker tableColumns={tableColumns} />}
                >
                  <table className="min-w-full divide-y divide-slate-200" style={panelTableLayoutStyle(tableColumns)}>
                    <thead className="bg-slate-50">
                      <tr>
                        <PanelTableTh colId="invoiceNo" className="table-th-center">Fatura No</PanelTableTh>
                        <PanelTableTh colId="invoiceDate" className="table-th-center">Düzenleme</PanelTableTh>
                        <PanelTableTh colId="dueDate" className="table-th-center">Vade</PanelTableTh>
                        <PanelTableTh colId="totalAmount" className="table-th-center">Tutar</PanelTableTh>
                        <PanelTableTh colId="status" className="table-th-center">Durum</PanelTableTh>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {invoices.map((inv) => (
                        <tr key={inv.id} className="transition-colors hover:bg-slate-50">
                          <PanelTableTd colId="invoiceNo" className="table-td-center px-4 py-3 text-sm font-medium text-slate-900">{inv.invoiceNo ?? '—'}</PanelTableTd>
                          <PanelTableTd colId="invoiceDate" className="table-td-center px-4 py-3 text-sm text-slate-600">{fmtDate(inv.invoiceDate)}</PanelTableTd>
                          <PanelTableTd colId="dueDate" className="table-td-center px-4 py-3 text-sm text-slate-600">{inv.dueDate ? fmtDate(inv.dueDate) : '—'}</PanelTableTd>
                          <PanelTableTd colId="totalAmount" className="table-td-center px-4 py-3 text-sm font-medium text-slate-900">{fmtMoney(inv.totalAmount)}</PanelTableTd>
                          <PanelTableTd colId="status" className="table-td-center px-4 py-3">
                            <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${statusColor(inv.status)}`}>
                              {statusLabel(inv.status)}
                            </span>
                          </PanelTableTd>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </PanelTableFrame>
              </TableColumnsProvider>
            </>
          )}
        </>
      )}
    </div>
  );
}
