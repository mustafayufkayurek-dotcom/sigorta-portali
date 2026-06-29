'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  usePanelTableColumns,
  TableColumnsProvider,
  PanelTableColumnPicker,
  PanelTableTh,
  PanelTableTd,
  panelTableLayoutStyle,
  type TableColumnDef,
} from '@/components/ui/TableColumnPicker';

const SIGORTA_INVOICE_TABLE_COLUMNS: TableColumnDef[] = [
  { id: 'invoiceNumber', label: 'Fatura No', defaultWidth: 120, minWidth: 96 },
  { id: 'issueDate', label: 'Düzenleme', defaultWidth: 104, minWidth: 88 },
  { id: 'dueDate', label: 'Vade', defaultWidth: 104, minWidth: 88 },
  { id: 'totalAmount', label: 'Tutar', defaultWidth: 108, minWidth: 88 },
  { id: 'status', label: 'Durum', defaultWidth: 108, minWidth: 88 },
];

const _apiBase = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000/api/v1';
const API = _apiBase.endsWith('/api/v1') ? _apiBase : `${_apiBase}/api/v1`;
function getHeaders() {
  const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : '';
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
}

interface Invoice {
  id: string;
  invoiceNumber: string;
  issueDate: string;
  dueDate?: string;
  totalAmount: number;
  status: string;
  insuranceCompany?: { name: string };
}

export default function SigortaFaturalarPage() {
  const router = useRouter();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const tableColumns = usePanelTableColumns('table-cols:sigorta-portal-faturalar', SIGORTA_INVOICE_TABLE_COLUMNS);

  useEffect(() => {
    const raw = localStorage.getItem('user');
    if (!raw) { router.push('/giris'); return; }
    const u = JSON.parse(raw);
    if (u?.role?.code !== 'insurance_company_user') { router.push('/panel'); return; }

    const scopes: any[] = u.insuranceCompanyScopes ?? [];
    if (scopes.length === 0) { setLoading(false); return; }

    const companyQuery = scopes.map((s) => `insuranceCompanyId=${s.id}`).join('&');
    fetch(`${API}/invoices?${companyQuery}&limit=50`, { headers: getHeaders() })
      .then((r) => r.json())
      .then((res) => { setInvoices(res?.data ?? []); setTotal(res?.meta?.total ?? 0); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [router]);

  const fmt = (d?: string) => d ? new Date(d).toLocaleDateString('tr-TR') : '—';
  const fmtMoney = (v: number) => v.toLocaleString('tr-TR', { style: 'currency', currency: 'TRY' });

  const statusLabel = (s: string) => {
    const map: Record<string, string> = { draft: 'Taslak', sent: 'Gönderildi', paid: 'Ödendi', overdue: 'Gecikmiş', cancelled: 'İptal' };
    return map[s] ?? s;
  };
  const statusColor = (s: string) => {
    const map: Record<string, string> = {
      draft: 'bg-slate-100 text-slate-600',
      sent: 'bg-blue-100 text-blue-700',
      paid: 'bg-green-100 text-green-700',
      overdue: 'bg-red-100 text-red-700',
      cancelled: 'bg-slate-100 text-slate-500',
    };
    return map[s] ?? 'bg-slate-100 text-slate-600';
  };

  if (loading) return <div className="flex items-center justify-center h-64 text-slate-500">Yükleniyor...</div>;

  const totalPaid = invoices.filter((i) => i.status === 'paid').reduce((s, i) => s + i.totalAmount, 0);
  const totalPending = invoices.filter((i) => i.status === 'sent' || i.status === 'overdue').reduce((s, i) => s + i.totalAmount, 0);

  return (
    <div className="space-y-4">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-xs text-slate-400 mb-2">
        <a href="/panel" className="hover:text-blue-600 transition-colors">Dashboard</a>
        <span>/</span>
        <a href="/panel/sigorta-portal" className="hover:text-blue-600 transition-colors">Sigorta Portal</a>
        <span>/</span>
        <span className="text-slate-600 font-medium">Faturalar</span>
      </nav>

      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-slate-900">Faturalar</h2>
        <span className="bg-purple-100 text-purple-800 text-sm font-medium px-3 py-1 rounded-full">{total} fatura</span>
      </div>

      {/* Özet */}
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

      {invoices.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 py-16 text-center">
          <p className="text-slate-500">Fatura bulunamadı.</p>
        </div>
      ) : (
        <TableColumnsProvider value={tableColumns}>
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-4 py-2 border-b border-slate-100 flex justify-end">
            <PanelTableColumnPicker tableColumns={tableColumns} />
          </div>
          <table className="min-w-full divide-y divide-slate-200" style={panelTableLayoutStyle(tableColumns)}>
            <thead className="bg-slate-50">
              <tr>
                <PanelTableTh colId="invoiceNumber" className="px-4 py-3 text-left text-xs font-medium text-slate-500">Fatura No</PanelTableTh>
                <PanelTableTh colId="issueDate" className="px-4 py-3 text-left text-xs font-medium text-slate-500">Düzenleme</PanelTableTh>
                <PanelTableTh colId="dueDate" className="px-4 py-3 text-left text-xs font-medium text-slate-500">Vade</PanelTableTh>
                <PanelTableTh colId="totalAmount" className="px-4 py-3 text-left text-xs font-medium text-slate-500">Tutar</PanelTableTh>
                <PanelTableTh colId="status" className="px-4 py-3 text-left text-xs font-medium text-slate-500">Durum</PanelTableTh>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {invoices.map((inv) => (
                <tr key={inv.id} className="hover:bg-slate-50 transition-colors">
                  <PanelTableTd colId="invoiceNumber" className="px-4 py-3 text-sm font-medium text-slate-900">{inv.invoiceNumber}</PanelTableTd>
                  <PanelTableTd colId="issueDate" className="px-4 py-3 text-sm text-slate-600">{fmt(inv.issueDate)}</PanelTableTd>
                  <PanelTableTd colId="dueDate" className="px-4 py-3 text-sm text-slate-600">{fmt(inv.dueDate)}</PanelTableTd>
                  <PanelTableTd colId="totalAmount" className="px-4 py-3 text-sm font-medium text-slate-900">{fmtMoney(inv.totalAmount)}</PanelTableTd>
                  <PanelTableTd colId="status" className="px-4 py-3">
                    <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${statusColor(inv.status)}`}>
                      {statusLabel(inv.status)}
                    </span>
                  </PanelTableTd>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        </TableColumnsProvider>
      )}
    </div>
  );
}
