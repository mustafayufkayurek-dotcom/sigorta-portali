'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import PortalPageHeader from '@/components/portal/PortalPageHeader';
import {
  ExpertFileDetailDrawer,
  type ExpertDrawerFile,
} from '@/components/eksper-portal/ExpertFileDetailDrawer';
import { ExpertFileDocumentsModal, ExpertFileNoteModal } from '@/components/eksper-portal/ExpertFileModals';
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
  { id: 'fileNo', label: 'Dosya No', defaultWidth: 120, minWidth: 96 },
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
  const [drawerFile, setDrawerFile] = useState<ExpertDrawerFile | null>(null);
  const [noteFileId, setNoteFileId] = useState<string | null>(null);
  const [docsFileId, setDocsFileId] = useState<string | null>(null);
  const [notesRefreshToken, setNotesRefreshToken] = useState(0);
  const tableColumns = usePanelTableColumns('table-cols:sigorta-portal-faturalar', SIGORTA_INVOICE_TABLE_COLUMNS);

  const openFileDrawer = (claim?: Invoice['claimFile']) => {
    if (!claim?.id) return;
    setDrawerFile({ id: claim.id, fileNo: claim.fileNo ?? '—' });
  };

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

  if (loading) return <div className="flex h-64 items-center justify-center text-slate-500">Yükleniyor...</div>;

  const totalPaid = invoices.filter((i) => i.status === 'paid').reduce((s, i) => s + i.totalAmount, 0);
  const totalPending = invoices.filter((i) => i.status === 'sent' || i.status === 'overdue').reduce((s, i) => s + i.totalAmount, 0);

  return (
    <div className="min-w-0 max-w-full space-y-4">
      <PortalPageHeader
        portalHomeHref="/panel/sigorta-portal"
        portalHomeLabel="Dosya Takip"
        currentLabel="Faturalar"
        title="Faturalar"
        actions={
          <span className="w-fit shrink-0 rounded-full bg-purple-100 px-3 py-1 text-sm font-medium text-purple-800">
            {total} fatura
          </span>
        }
      />

      {error && (
        <div className="flex items-center justify-between rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-red-700">
          <span>{error}</span>
          <button type="button" onClick={() => setError(null)} className="ml-4 font-bold text-red-700 hover:text-red-900">&times;</button>
        </div>
      )}

      {missingScope ? (
        <div className="rounded-xl border border-amber-200 bg-white px-6 py-16 text-center">
          <p className="font-medium text-slate-700">Sigorta şirketi kapsamı tanımlı değil.</p>
          <p className="mt-2 text-sm text-slate-500">Fatura listesi için hesabınıza sigorta şirketi atanmalıdır.</p>
        </div>
      ) : (
        <>
          {invoices.length > 0 && (
            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-xl border border-slate-200 bg-white p-4">
                <p className="mb-1 text-xs text-slate-500">Ödenen Toplam</p>
                <p className="text-lg font-bold text-status-success">{fmtMoney(totalPaid)}</p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white p-4">
                <p className="mb-1 text-xs text-slate-500">Bekleyen Toplam</p>
                <p className="text-lg font-bold text-status-warning">{fmtMoney(totalPending)}</p>
              </div>
            </div>
          )}

          {!error && invoices.length === 0 ? (
            <div className="rounded-xl border border-slate-200 bg-white py-16 text-center">
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
                        {inv.claimFile?.id ? (
                          <button
                            type="button"
                            onClick={() => openFileDrawer(inv.claimFile)}
                            className="mt-1 block text-xs font-semibold text-brand-600 hover:underline"
                          >
                            Dosya: {inv.claimFile.fileNo ?? '—'}
                          </button>
                        ) : inv.claimFile?.fileNo ? (
                          <p className="mt-1 text-xs text-slate-500">Dosya: {inv.claimFile.fileNo}</p>
                        ) : null}
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
                        <PanelTableTh colId="fileNo" className="table-th-center">Dosya No</PanelTableTh>
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
                          <PanelTableTd colId="fileNo" className="table-td-center px-4 py-3 text-sm">
                            {inv.claimFile?.id ? (
                              <button
                                type="button"
                                onClick={() => openFileDrawer(inv.claimFile)}
                                className="font-semibold text-brand-600 hover:underline"
                              >
                                {inv.claimFile.fileNo ?? '—'}
                              </button>
                            ) : (
                              <span className="text-slate-600">{inv.claimFile?.fileNo ?? '—'}</span>
                            )}
                          </PanelTableTd>
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

      <ExpertFileDetailDrawer
        open={Boolean(drawerFile)}
        onClose={() => setDrawerFile(null)}
        file={drawerFile}
        initialTab="ozet"
        onOpenDocuments={() => drawerFile && setDocsFileId(drawerFile.id)}
        onOpenNote={() => drawerFile && setNoteFileId(drawerFile.id)}
        notesRefreshToken={notesRefreshToken}
      />
      <ExpertFileDocumentsModal
        open={Boolean(docsFileId)}
        claimFileId={docsFileId}
        onClose={() => setDocsFileId(null)}
      />
      <ExpertFileNoteModal
        open={Boolean(noteFileId)}
        claimFileId={noteFileId}
        onClose={() => setNoteFileId(null)}
        onSaved={() => {
          setNotesRefreshToken((n) => n + 1);
          setNoteFileId(null);
        }}
      />
    </div>
  );
}
