'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/contexts/ToastContext';
import {
  getInvoiceRequests,
  updateInvoiceRequestStatus,
  type InvoiceRequest,
  type InvoiceRequestStatus,
  type WorkItem,
} from '@/utils/invoiceRequestApi';
import {
  usePanelTableColumns,
  TableColumnsProvider,
  PanelTableColumnPicker,
  PanelTableTh,
  PanelTableTd,
  panelTableLayoutStyle,
  type TableColumnDef,
} from '@/components/ui/TableColumnPicker';

const INVOICE_REQUEST_TABLE_COLUMNS: TableColumnDef[] = [
  { id: 'tarih', label: 'Tarih', defaultWidth: 104, minWidth: 88 },
  { id: 'dosyaNo', label: 'Dosya No', defaultWidth: 108, minWidth: 88 },
  { id: 'tedarikci', label: 'Sigorta / Kaynak', defaultWidth: 140, minWidth: 100 },
  { id: 'aciklama', label: 'Açıklama', defaultWidth: 200, minWidth: 120 },
  { id: 'tutar', label: 'Tutar', defaultWidth: 108, minWidth: 88 },
  { id: 'durum', label: 'Durum', defaultWidth: 108, minWidth: 88 },
];

function fmtCurrency(n: number) {
  return n.toLocaleString('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 0 });
}
function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('tr-TR');
}

const DURUM_LABEL: Record<InvoiceRequestStatus, string> = {
  pending: 'Bekliyor',
  approved: 'Onaylandı',
  invoiced: 'Faturalandı',
  cancelled: 'İptal',
};

const DURUM_COLOR: Record<InvoiceRequestStatus, string> = {
  pending: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-400',
  approved: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400',
  invoiced: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400',
  cancelled: 'bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-400',
};

const DURUM_DOT: Record<InvoiceRequestStatus, string> = {
  pending: 'bg-yellow-400',
  approved: 'bg-blue-500',
  invoiced: 'bg-green-500',
  cancelled: 'bg-status-danger',
};

type FilterKey = 'tumu' | InvoiceRequestStatus;

function workItemsDescription(items: WorkItem[] | unknown, notes?: string | null): string {
  if (Array.isArray(items) && items.length > 0) {
    const text = items.map((i) => i.description).filter(Boolean).join('; ');
    if (text) return text;
  }
  return notes?.trim() || '—';
}

function sigortaKaynak(req: InvoiceRequest): string {
  return req.insuranceCompany?.name ?? req.insuranceCompanyName ?? (req.serviceType === 'emergency' ? 'Acil Yardım' : '—');
}

export type TalepOzet = {
  total: number;
  pendingCount: number;
  pendingAmount: number;
  approvedCount: number;
  approvedAmount: number;
};

export function computeTalepOzet(talepler: InvoiceRequest[]): TalepOzet {
  return {
    total: talepler.length,
    pendingCount: talepler.filter((t) => t.status === 'pending').length,
    pendingAmount: talepler.filter((t) => t.status === 'pending').reduce((s, t) => s + (t.totalAmount ?? 0), 0),
    approvedCount: talepler.filter((t) => t.status === 'approved').length,
    approvedAmount: talepler.filter((t) => t.status === 'approved').reduce((s, t) => s + (t.totalAmount ?? 0), 0),
  };
}

interface FaturaTalepleriSectionProps {
  onOzetChange?: (ozet: TalepOzet) => void;
}

export function FaturaTalepleriSection({ onOzetChange }: FaturaTalepleriSectionProps) {
  const router = useRouter();
  const { showToast } = useToast();
  const [talepler, setTalepler] = useState<InvoiceRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<FilterKey>('tumu');
  const tableColumns = usePanelTableColumns('table-cols:finans-fatura-talepleri', INVOICE_REQUEST_TABLE_COLUMNS);

  const load = useCallback(() => {
    setLoading(true);
    setError('');
    getInvoiceRequests()
      .then((data) => {
        setTalepler(data);
        onOzetChange?.(computeTalepOzet(data));
      })
      .catch((err) => {
        if (err instanceof Error && err.message.startsWith('401:')) {
          router.push('/giris');
          return;
        }
        setError('Fatura talepleri yüklenemedi.');
        setTalepler([]);
        onOzetChange?.({ total: 0, pendingCount: 0, pendingAmount: 0, approvedCount: 0, approvedAmount: 0 });
      })
      .finally(() => setLoading(false));
  }, [router, onOzetChange]);

  useEffect(() => { load(); }, [load]);

  const handleDurumChange = async (id: string, yeniDurum: InvoiceRequestStatus) => {
    const prev = talepler.find((t) => t.id === id);
    if (!prev || prev.status === yeniDurum) return;
    try {
      const updated = await updateInvoiceRequestStatus(id, yeniDurum);
      setTalepler((list) => {
        const next = list.map((t) => (t.id === id ? updated : t));
        onOzetChange?.(computeTalepOzet(next));
        return next;
      });
      showToast('success', `Talep durumu "${DURUM_LABEL[yeniDurum]}" olarak güncellendi.`);
    } catch (err: unknown) {
      if (err instanceof Error && err.message.startsWith('401:')) {
        router.push('/giris');
        return;
      }
      const msg = err instanceof Error ? err.message.replace(/^\d+:\s*/, '') : 'Durum güncellenemedi.';
      showToast('error', msg);
    }
  };

  const filtered = filter === 'tumu' ? talepler : talepler.filter((t) => t.status === filter);

  const counts: Record<FilterKey, number> = {
    tumu: talepler.length,
    pending: talepler.filter((t) => t.status === 'pending').length,
    approved: talepler.filter((t) => t.status === 'approved').length,
    invoiced: talepler.filter((t) => t.status === 'invoiced').length,
    cancelled: talepler.filter((t) => t.status === 'cancelled').length,
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-500 dark:text-slate-400">
        Dosya kapanışı için sahadan gelen talepler. Onayladıktan sonra kesilen fatura &quot;Kesilen Faturalar&quot; sekmesinde görünür.
      </p>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 px-4 py-3 rounded-xl text-sm">
          {error}
        </div>
      )}

      <div className="flex flex-wrap gap-1.5">
        {(['tumu', 'pending', 'approved', 'invoiced', 'cancelled'] as FilterKey[]).map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => setFilter(k)}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
              filter === k
                ? 'bg-brand-600 border-brand-600 text-white'
                : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700'
            }`}
          >
            {k === 'tumu' ? 'Tümü' : DURUM_LABEL[k as InvoiceRequestStatus]}
            <span className={`ml-1.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold ${filter === k ? 'bg-white/20 text-white' : 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400'}`}>
              {counts[k]}
            </span>
          </button>
        ))}
      </div>

      <TableColumnsProvider value={tableColumns}>
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700 shadow-sm overflow-hidden">
          <div className="px-4 py-2 border-b border-slate-100 dark:border-slate-700 flex justify-end">
            <PanelTableColumnPicker tableColumns={tableColumns} />
          </div>
          {loading ? (
            <div className="animate-pulse p-6 space-y-3">
              {[...Array(5)].map((_, i) => <div key={i} className="h-10 bg-slate-100 dark:bg-slate-700 rounded" />)}
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-16 flex flex-col items-center gap-3">
              <p className="text-sm text-slate-400 dark:text-slate-500">Henüz fatura talebi bulunmamaktadır.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm" style={panelTableLayoutStyle(tableColumns)}>
                <thead className="bg-slate-50 dark:bg-slate-700/40 border-b border-slate-100 dark:border-slate-700">
                  <tr>
                    <PanelTableTh colId="tarih" className="px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 text-center">Tarih</PanelTableTh>
                    <PanelTableTh colId="dosyaNo" className="px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 text-center">Dosya No</PanelTableTh>
                    <PanelTableTh colId="tedarikci" className="px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 text-center">Sigorta / Kaynak</PanelTableTh>
                    <PanelTableTh colId="aciklama" className="px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 text-center">Açıklama</PanelTableTh>
                    <PanelTableTh colId="tutar" className="px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 text-center">Tutar</PanelTableTh>
                    <PanelTableTh colId="durum" className="px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 text-center">Durum</PanelTableTh>
                    <th className="px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 text-center">İşlem</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50 dark:divide-slate-700/50">
                  {filtered.map((t, idx) => (
                    <tr key={t.id} className={`hover:bg-slate-50/70 dark:hover:bg-slate-700/40 transition-colors ${idx % 2 !== 0 ? 'bg-slate-50/30' : ''}`}>
                      <PanelTableTd colId="tarih" className="px-4 py-3 text-xs text-slate-500 dark:text-slate-400">{fmtDate(t.createdAt)}</PanelTableTd>
                      <PanelTableTd colId="dosyaNo" className="px-4 py-3">
                        <span className="text-xs font-mono text-brand-600 dark:text-blue-400">{t.fileNo}</span>
                      </PanelTableTd>
                      <PanelTableTd colId="tedarikci" className="px-4 py-3 text-slate-700 dark:text-slate-200 font-medium">{sigortaKaynak(t)}</PanelTableTd>
                      <PanelTableTd colId="aciklama" className="px-4 py-3 text-slate-500 dark:text-slate-400 text-xs">
                        {workItemsDescription(t.workItemsSummary, t.notes)}
                      </PanelTableTd>
                      <PanelTableTd colId="tutar" className="px-4 py-3 text-right font-semibold text-slate-800 dark:text-slate-100">{fmtCurrency(t.totalAmount)}</PanelTableTd>
                      <PanelTableTd colId="durum" className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-medium ${DURUM_COLOR[t.status]}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${DURUM_DOT[t.status]}`} />
                          {DURUM_LABEL[t.status]}
                        </span>
                      </PanelTableTd>
                      <td className="px-4 py-3">
                        <select
                          value={t.status}
                          onChange={(e) => handleDurumChange(t.id, e.target.value as InvoiceRequestStatus)}
                          className="text-xs bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded px-2 py-1 text-slate-600 dark:text-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-400"
                        >
                          {(Object.keys(DURUM_LABEL) as InvoiceRequestStatus[]).map((d) => (
                            <option key={d} value={d}>{DURUM_LABEL[d]}</option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </TableColumnsProvider>
    </div>
  );
}
