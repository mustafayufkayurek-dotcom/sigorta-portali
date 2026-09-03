'use client';

import { API, authHeader } from '@/utils/api';
import { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import {
  usePanelTableColumns,
  TableColumnsProvider,
  PanelTableColumnPicker,
  PanelTableTd,
  PanelTableTh,
  SortablePanelTableTh,
  panelTableLayoutStyle,
  type TableColumnDef,
} from '@/components/ui/TableColumnPicker';
import { FinansSubpageBreadcrumb } from '@/components/finance/FinansSubpageBreadcrumb';
import {
  FinansActionButton,
  FinansEmptyState,
  FinansFieldLabel,
  FinansFormPanel,
  FinansPanelCard,
  finansInputClass,
} from '@/components/finance/FinansPanelUI';
import { EditButton, SettingsTableActions } from '@/components/settings/SettingsUI';
import {
  cycleClientSort,
  sortRowsByClientSort,
  type ClientSortState,
} from '@/utils/panel-table-sort';
import { useToast } from '@/contexts/ToastContext';
import { getApiErrorMessage } from '@/utils/api-error';
import { FinansTablePager } from '@/components/finance/FinansTablePager';
import { FINANS_ACTIONS_COLUMN, FINANS_TABLE_PAGE_KEYS, readFinansTablePageSize, sliceFinansPage, type FinansTablePageSize } from '@/utils/finans-table-page';

const BANK_ACCOUNT_TABLE_COLUMNS: TableColumnDef[] = [
  { id: 'bankName', label: 'Banka', defaultWidth: 140, minWidth: 100 },
  { id: 'branchName', label: 'Şube', defaultWidth: 120, minWidth: 88 },
  { id: 'iban', label: 'IBAN', defaultWidth: 200, minWidth: 140 },
  { id: 'currency', label: 'Para Birimi', defaultWidth: 96, minWidth: 72 },
  { id: 'status', label: 'Durum', defaultWidth: 88, minWidth: 72 },
  FINANS_ACTIONS_COLUMN,
];



export default function BankaHesaplariPage() {
  const { showToast } = useToast();
  const [accounts, setAccounts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<any>({ bankName: '', branchName: '', iban: '', currency: 'TRY', isActive: true });
  const [saving, setSaving] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [clientSort, setClientSort] = useState<ClientSortState>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<FinansTablePageSize>(() =>
    readFinansTablePageSize(FINANS_TABLE_PAGE_KEYS.banka, 20),
  );
  const tableColumns = usePanelTableColumns('table-cols:finans-banka-hesaplari', BANK_ACCOUNT_TABLE_COLUMNS);

  const sortedAccounts = useMemo(
    () =>
      sortRowsByClientSort(accounts, clientSort, (acc, key) => {
        switch (key) {
          case 'bankName':
            return acc.bankName ?? '';
          case 'branchName':
            return acc.branchName ?? '';
          case 'iban':
            return acc.iban ?? '';
          case 'currency':
            return acc.currency ?? '';
          case 'status':
            return acc.isActive ? 'Aktif' : 'Pasif';
          default:
            return '';
        }
      }),
    [accounts, clientSort],
  );
  const pagedAccounts = sliceFinansPage(sortedAccounts, page, pageSize);

  const load = () => {
    setLoading(true);
    setError('');
    axios.get(`${API}/bank-accounts`, { headers: authHeader() })
      .then((r) => setAccounts(r.data.data ?? []))
      .catch(() => setError('Veriler yüklenemedi'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleSave = async () => {
    if (!form.bankName || !form.iban) { showToast('warning', 'Banka Adı ve IBAN Zorunludur'); return; }
    setSaving(true);
    try {
      if (editId) {
        await axios.patch(`${API}/bank-accounts/${editId}`, form, { headers: authHeader() });
      } else {
        await axios.post(`${API}/bank-accounts`, form, { headers: authHeader() });
      }
      setShowForm(false);
      setEditId(null);
      setForm({ bankName: '', branchName: '', iban: '', currency: 'TRY', isActive: true });
      load();
    } catch (e: unknown) { showToast('error', getApiErrorMessage(e, 'Hata oluştu')); }
    finally { setSaving(false); }
  };

  const handleEdit = (acc: any) => {
    setEditId(acc.id);
    setForm({ bankName: acc.bankName, branchName: acc.branchName ?? '', iban: acc.iban, currency: acc.currency, isActive: acc.isActive });
    setShowForm(true);
  };

  return (
    <div className="space-y-5 min-h-screen bg-white dark:bg-slate-900 p-6">
      <FinansSubpageBreadcrumb current="Banka Hesapları" />
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Banka Hesapları</h2>
          <p className="text-sm text-slate-500 mt-0.5">Tahsilat ve ödeme için kayıtlı hesaplar.</p>
        </div>
        <FinansActionButton
          label={showForm ? 'Formu Kapat' : 'Yeni Hesap'}
          onClick={() => {
            if (showForm) {
              setShowForm(false);
              setEditId(null);
              return;
            }
            setShowForm(true);
            setEditId(null);
            setForm({ bankName: '', branchName: '', iban: '', currency: 'TRY', isActive: true });
          }}
          variant={showForm ? 'neutral' : 'primary'}
          active={showForm}
          showPlus={!showForm}
        />
      </div>

      {showForm && (
        <FinansFormPanel
          title={editId ? 'Hesabı Düzenle' : 'Yeni Banka Hesabı'}
          onCancel={() => { setShowForm(false); setEditId(null); }}
          onSubmit={() => { void handleSave(); }}
          saving={saving}
        >
          <div className="grid grid-cols-2 gap-4">
            <div>
              <FinansFieldLabel required>Banka Adı</FinansFieldLabel>
              <input type="text" value={form.bankName} onChange={(e) => setForm({ ...form, bankName: e.target.value })} className={finansInputClass} placeholder="Garanti BBVA" />
            </div>
            <div>
              <FinansFieldLabel>Şube Adı</FinansFieldLabel>
              <input type="text" value={form.branchName} onChange={(e) => setForm({ ...form, branchName: e.target.value })} className={finansInputClass} placeholder="Merkez Şube" />
            </div>
            <div className="col-span-2">
              <FinansFieldLabel required>IBAN</FinansFieldLabel>
              <input type="text" value={form.iban} onChange={(e) => setForm({ ...form, iban: e.target.value })} className={`${finansInputClass} font-mono`} placeholder="TR00 0000 0000 0000 0000 0000 00" />
            </div>
            <div>
              <FinansFieldLabel>Para Birimi</FinansFieldLabel>
              <select value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })} className={finansInputClass}>
                <option value="TRY">TRY</option>
                <option value="USD">USD</option>
                <option value="EUR">EUR</option>
              </select>
            </div>
            <div className="flex items-center gap-2 pt-6">
              <input type="checkbox" id="isActive" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} className="rounded" />
              <label htmlFor="isActive" className="text-sm text-slate-700">Aktif</label>
            </div>
          </div>
        </FinansFormPanel>
      )}

      {loading ? (
        <div className="py-12 text-center text-slate-400">Yükleniyor...</div>
      ) : error ? (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4">{error}</div>
      ) : accounts.length === 0 ? (
        <FinansPanelCard title="Banka Hesapları">
          <FinansEmptyState title="Kayıtlı banka hesabı yok." description="Tahsilat ve ödeme için hesap ekleyin." />
        </FinansPanelCard>
      ) : (
        <TableColumnsProvider value={tableColumns}>
        <FinansPanelCard title="Banka Hesapları" subtitle={`${accounts.length} kayıt`} noPadding>
          <div className="px-4 py-2 border-b border-slate-100 flex justify-end">
            <PanelTableColumnPicker tableColumns={tableColumns} />
          </div>
          <table className="w-full text-sm" style={panelTableLayoutStyle(tableColumns)}>
            <thead className="bg-slate-50 text-xs text-slate-500">
              <tr>
                {tableColumns.prefs.orderedVisibleColumns.map((col) => (
                  col.id === 'actions' ? (
                    <PanelTableTh key={col.id} colId={col.id} className="text-center px-2 py-3" resizable={false}>{col.label}</PanelTableTh>
                  ) : (
                    <SortablePanelTableTh key={col.id} colId={col.id} sortKey={col.id} activeSortKey={clientSort?.key ?? null} sortDir={clientSort?.dir ?? 'asc'} onSort={(k) => setClientSort((p) => cycleClientSort(p, k))} className="text-center px-4 py-3">{col.label}</SortablePanelTableTh>
                  )
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {pagedAccounts.slice.map((acc) => (
                <tr key={acc.id} className="hover:bg-slate-50">
                  {tableColumns.prefs.orderedVisibleColumns.map((col) => {
                    switch (col.id) {
                      case 'bankName':
                        return <PanelTableTd key={col.id} colId="bankName" className="px-4 py-3 font-medium text-slate-800">{acc.bankName}</PanelTableTd>;
                      case 'branchName':
                        return <PanelTableTd key={col.id} colId="branchName" className="px-4 py-3 text-slate-600">{acc.branchName ?? '—'}</PanelTableTd>;
                      case 'iban':
                        return <PanelTableTd key={col.id} colId="iban" className="px-4 py-3 font-mono text-xs text-slate-700">{acc.iban}</PanelTableTd>;
                      case 'currency':
                        return <PanelTableTd key={col.id} colId="currency" className="px-4 py-3 text-slate-600">{acc.currency}</PanelTableTd>;
                      case 'status':
                        return (
                          <PanelTableTd key={col.id} colId="status" className="px-4 py-3">
                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${acc.isActive ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>{acc.isActive ? 'Aktif' : 'Pasif'}</span>
                          </PanelTableTd>
                        );
                      case 'actions':
                        return (
                          <PanelTableTd key={col.id} colId="actions" className="px-2 py-3">
                            <SettingsTableActions>
                              <EditButton onClick={() => handleEdit(acc)} />
                            </SettingsTableActions>
                          </PanelTableTd>
                        );
                      default:
                        return null;
                    }
                  })}
                </tr>
              ))}
            </tbody>
          </table>
          <FinansTablePager
            page={pagedAccounts.safePage}
            pageSize={pageSize}
            total={sortedAccounts.length}
            storageKey={FINANS_TABLE_PAGE_KEYS.banka}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
          />
        </FinansPanelCard>
        </TableColumnsProvider>
      )}
    </div>
  );
}
