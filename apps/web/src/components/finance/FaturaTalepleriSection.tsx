'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/contexts/ToastContext';
import {
  fileOwnerNotifyToast,
  getInvoiceRequests,
  notifyInvoiceRequestOwner,
  updateInvoiceRequestStatus,
  bulkMarkInvoiceRequestsInvoiced,
  type InvoiceRequest,
  type InvoiceRequestStatus,
} from '@/utils/invoiceRequestApi';
import { getCase } from '@/utils/emergencyApi';
import { FaturaTalepListeKart } from '@/components/finance/FaturaTalepListeKart';
import { FINANS_FATURA_TALEP_ROW_ACTIONS } from '@/components/portal/portal-row-action-prefs';
import { usePortalRowActionPrefs } from '@/components/portal/use-portal-row-action-prefs';
import { invoicePartyCustomerName } from '@/utils/invoice-customer-name';
import {
  usePanelTableColumns,
  TableColumnsProvider,
  type TableColumnDef,
} from '@/components/ui/TableColumnPicker';
import {
  sortRowsByClientSort,
  type ClientSortState,
} from '@/utils/panel-table-sort';
import { FinansFieldLabel, finansInputClass } from '@/components/finance/FinansPanelUI';
import { invoiceRequestWorkItems } from '@/utils/invoice-request-work-items';
import { FINANS_ACTIONS_COLUMN, FINANS_TABLE_PAGE_KEYS, readFinansTablePageSize, type FinansTablePageSize } from '@/utils/finans-table-page';
import { markInvoiceRequestsSeen } from '@/utils/invoice-request-alert';
import { HintIcon } from '@/components/ui/HintIcon';
import {
  canSelectAcilInvoiceRequest,
  partitionInvoiceRequests,
  selectedAcilInvoiceTotals,
} from '@/utils/invoice-request-official';

const INVOICE_REQUEST_TABLE_COLUMNS: TableColumnDef[] = [
  { id: 'tarih', label: 'Tarih', defaultWidth: 104, minWidth: 88 },
  { id: 'dosyaNo', label: 'Dosya No', defaultWidth: 168, minWidth: 128 },
  { id: 'customer', label: 'Müşteri', defaultWidth: 168, minWidth: 120 },
  { id: 'aciklama', label: 'Yapılan İş Kalemi', defaultWidth: 200, minWidth: 120 },
  { id: 'tutar', label: 'Tutar', defaultWidth: 108, minWidth: 88 },
  { id: 'durum', label: 'Durum', defaultWidth: 108, minWidth: 88 },
  FINANS_ACTIONS_COLUMN,
];

function fmtCurrency(n: number) {
  return n.toLocaleString('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 0 });
}
function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('tr-TR');
}

function isoDateInput(d = new Date()) {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function moneyInput(n: number) {
  return String(Math.round(n * 100) / 100);
}

const DURUM_LABEL: Record<InvoiceRequestStatus, string> = {
  pending: 'Bekliyor',
  approved: 'Onaylandı',
  invoiced: 'Faturalandı',
  cancelled: 'İptal',
};

type FilterKey = 'tumu' | InvoiceRequestStatus;

function workItemsDescription(req: InvoiceRequest): string {
  const items = invoiceRequestWorkItems(req);
  const text = items.map((i) => i.description).filter(Boolean).join('; ');
  if (text) return text;
  return req.notes?.trim() || '—';
}

function talepMusteri(req: InvoiceRequest): string {
  return invoicePartyCustomerName({
    collectionParty: req.claimFile?.collectionParty,
    insuredName: req.claimFile?.insuredName,
    customer: req.claimFile?.customer,
    insuranceCompanyName: req.claimFile?.insuranceCompany?.name ?? req.insuranceCompany?.name ?? req.insuranceCompanyName,
    emergencyCustomerName: req.emergencyCase?.customerName,
  });
}

async function withEmergencyIssueTypes(rows: InvoiceRequest[]): Promise<InvoiceRequest[]> {
  const missing = rows.filter(
    (row) => row.serviceType === 'emergency' && row.emergencyCaseId && !String(row.emergencyCase?.issueType ?? '').trim(),
  );
  if (missing.length === 0) return rows;
  const found = await Promise.all(
    missing.map(async (row) => {
      try {
        const res = await getCase(row.emergencyCaseId!);
        return [row.id, String(res.data.issueType ?? '').trim()] as const;
      } catch {
        return [row.id, ''] as const;
      }
    }),
  );
  const byId = Object.fromEntries(found.filter(([, issue]) => Boolean(issue)));
  return rows.map((row) => {
    const issue = byId[row.id];
    if (!issue) return row;
    return {
      ...row,
      emergencyCase: {
        caseNo: row.emergencyCase?.caseNo ?? row.fileNo,
        id: row.emergencyCase?.id ?? row.emergencyCaseId ?? row.id,
        customerName: row.emergencyCase?.customerName,
        issueType: issue,
      },
    };
  });
}

export type TalepOzet = {
  total: number;
  pendingCount: number;
  pendingAmount: number;
  approvedCount: number;
  approvedAmount: number;
  pendingIds: string[];
};

export function computeTalepOzet(talepler: InvoiceRequest[]): TalepOzet {
  const pending = talepler.filter((t) => t.status === 'pending');
  return {
    total: talepler.length,
    pendingCount: pending.length,
    pendingAmount: pending.reduce((s, t) => s + (t.totalAmount ?? 0), 0),
    approvedCount: talepler.filter((t) => t.status === 'approved').length,
    approvedAmount: talepler.filter((t) => t.status === 'approved').reduce((s, t) => s + (t.totalAmount ?? 0), 0),
    pendingIds: pending.map((t) => t.id),
  };
}

interface FaturaTalepleriSectionProps {
  onOzetChange?: (ozet: TalepOzet) => void;
  onIssuedChange?: () => void;
  initialFilter?: FilterKey;
}

export function FaturaTalepleriSection({ onOzetChange, onIssuedChange, initialFilter = 'pending' }: FaturaTalepleriSectionProps) {
  const router = useRouter();
  const { showToast } = useToast();
  const [talepler, setTalepler] = useState<InvoiceRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<FilterKey>(initialFilter);
  const [invoicing, setInvoicing] = useState<InvoiceRequest[]>([]);
  const [invoiceNoDraft, setInvoiceNoDraft] = useState('');
  const [invoiceDateDraft, setInvoiceDateDraft] = useState(isoDateInput());
  const [documentDateDraft, setDocumentDateDraft] = useState(isoDateInput());
  const [subtotalDraft, setSubtotalDraft] = useState('');
  const [vatDraft, setVatDraft] = useState('');
  const [grossDraft, setGrossDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const [hasarPage, setHasarPage] = useState(1);
  const [acilPage, setAcilPage] = useState(1);
  const [pageSize, setPageSize] = useState<FinansTablePageSize>(() =>
    readFinansTablePageSize(FINANS_TABLE_PAGE_KEYS.talepler, 10),
  );
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const tableColumns = usePanelTableColumns('table-cols:finans-fatura-talepleri-v4', INVOICE_REQUEST_TABLE_COLUMNS);
  const rowActions = usePortalRowActionPrefs('row-actions:finans-fatura-talepleri-v3', FINANS_FATURA_TALEP_ROW_ACTIONS);
  const [clientSort, setClientSort] = useState<ClientSortState>(null);
  const [inspecting, setInspecting] = useState<InvoiceRequest | null>(null);
  const [cancelling, setCancelling] = useState<InvoiceRequest | null>(null);
  const [cancelReasonDraft, setCancelReasonDraft] = useState('');

  const load = useCallback(() => {
    setLoading(true);
    setError('');
    getInvoiceRequests()
      .then(withEmergencyIssueTypes)
      .then((data) => {
        setTalepler(data);
        const ozet = computeTalepOzet(data);
        onOzetChange?.(ozet);
        markInvoiceRequestsSeen(ozet.pendingIds);
      })
      .catch((err) => {
        if (err instanceof Error && err.message.startsWith('401:')) {
          router.push('/giris');
          return;
        }
        setError('Fatura talepleri yüklenemedi.');
        setTalepler([]);
        onOzetChange?.({ total: 0, pendingCount: 0, pendingAmount: 0, approvedCount: 0, approvedAmount: 0, pendingIds: [] });
      })
      .finally(() => setLoading(false));
  }, [router, onOzetChange]);

  useEffect(() => { load(); }, [load]);

  const applyUpdatedMany = (updatedRows: InvoiceRequest[]) => {
    setTalepler((list) => {
      const byId = new Map(updatedRows.map((row) => [row.id, row]));
      const next = list.map((t): InvoiceRequest => {
        const updated = byId.get(t.id);
        if (!updated) return t;
        const issueType = updated.emergencyCase?.issueType ?? t.emergencyCase?.issueType;
        if (!updated.emergencyCase && !t.emergencyCase) return updated;
        return {
          ...updated,
          emergencyCase: {
            caseNo: updated.emergencyCase?.caseNo ?? t.emergencyCase?.caseNo ?? updated.fileNo,
            id: updated.emergencyCase?.id ?? t.emergencyCase?.id ?? updated.emergencyCaseId ?? updated.id,
            customerName: updated.emergencyCase?.customerName ?? t.emergencyCase?.customerName,
            issueType,
          },
        };
      });
      onOzetChange?.(computeTalepOzet(next));
      return next;
    });
  };

  const applyUpdated = (updated: InvoiceRequest) => applyUpdatedMany([updated]);

  const officialExtras = () => ({
    salesInvoiceNo: invoiceNoDraft.trim(),
    invoiceDate: invoiceDateDraft.trim() || undefined,
    documentDate: documentDateDraft.trim() || undefined,
    subtotalAmount: Number(subtotalDraft.replace(',', '.')) || 0,
    vatAmount: Number(vatDraft.replace(',', '.')) || 0,
    totalAmount: Number(grossDraft.replace(',', '.')) || 0,
  });

  const resetInvoiceDraft = () => {
    setInvoicing([]);
    setInvoiceNoDraft('');
    setInvoiceDateDraft(isoDateInput());
    setDocumentDateDraft(isoDateInput());
    setSubtotalDraft('');
    setVatDraft('');
    setGrossDraft('');
  };

  const handleDurumChange = async (
    id: string,
    yeniDurum: InvoiceRequestStatus,
    extras?: {
      salesInvoiceNo?: string;
      cancelReason?: string;
      invoiceDate?: string;
      documentDate?: string;
      subtotalAmount?: number;
      vatAmount?: number;
      totalAmount?: number;
    },
  ) => {
    const prev = talepler.find((t) => t.id === id);
    if (!prev) return;
    if (yeniDurum === 'cancelled' && prev.status === 'cancelled') {
      showToast('info', 'Bu talep zaten iptal.');
      return;
    }
    if (prev.status === yeniDurum && !extras?.salesInvoiceNo) return;
    if (yeniDurum === 'cancelled') {
      const reason = extras?.cancelReason?.trim();
      if (!reason) {
        showToast('error', 'İptal açıklaması zorunlu.');
        return false;
      }
    }
    try {
      const updated = await updateInvoiceRequestStatus(id, yeniDurum, extras);
      applyUpdated(updated);
      if (yeniDurum === 'invoiced') onIssuedChange?.();
      showToast(
        'success',
        yeniDurum === 'invoiced'
          ? 'Resmi fatura kaydedildi. İş Faturalandı göründü.'
          : `Talep durumu "${DURUM_LABEL[yeniDurum]}" olarak güncellendi.`,
      );
      return true;
    } catch (err: unknown) {
      if (err instanceof Error && err.message.startsWith('401:')) {
        router.push('/giris');
        return false;
      }
      const msg = err instanceof Error ? err.message.replace(/^\d+:\s*/, '') : 'Durum güncellenemedi.';
      showToast('error', msg);
      return false;
    }
  };

  const fillOfficialDraft = (rows: InvoiceRequest[]) => {
    const totals = selectedAcilInvoiceTotals(rows);
    const today = isoDateInput();
    setInvoiceNoDraft('');
    setInvoiceDateDraft(today);
    setDocumentDateDraft(today);
    setSubtotalDraft(moneyInput(totals.net));
    setVatDraft(moneyInput(totals.vat));
    setGrossDraft(moneyInput(totals.gross));
    setInvoicing(rows);
  };

  const openInvoicedModal = (req: InvoiceRequest) => {
    if (req.status === 'invoiced') {
      showToast('info', 'Faturalandı. Kesilen Faturalar sayfasından düzenleyin.');
      return;
    }
    if (req.status === 'cancelled') {
      showToast('info', 'İptal talebi düzenlenmez.');
      return;
    }
    fillOfficialDraft([req]);
  };

  const openBulkInvoicedModal = (rows: InvoiceRequest[]) => {
    const open = rows.filter(canSelectAcilInvoiceRequest);
    if (open.length === 0) {
      showToast('error', 'Faturalanacak Acil Yardım dosyası seçin.');
      return;
    }
    fillOfficialDraft(open);
  };

  const confirmInvoiced = async () => {
    if (invoicing.length === 0) return;
    const extras = officialExtras();
    if (!extras.salesInvoiceNo) {
      showToast('error', 'Satış fatura numarası gerekli.');
      return;
    }
    if (!extras.invoiceDate) {
      showToast('error', 'Fatura tarihi gerekli.');
      return;
    }
    setSaving(true);
    try {
      if (invoicing.length > 1) {
        const updated = await bulkMarkInvoiceRequestsInvoiced({
          ids: invoicing.map((row) => row.id),
          ...extras,
        });
        applyUpdatedMany(updated);
        onIssuedChange?.();
        setSelectedIds(new Set());
        showToast('success', `${updated.length} dosya aynı resmi faturayla Faturalandı göründü.`);
        resetInvoiceDraft();
        return;
      }
      const ok = await handleDurumChange(invoicing[0].id, 'invoiced', extras);
      if (ok) resetInvoiceDraft();
    } catch (err: unknown) {
      if (err instanceof Error && err.message.startsWith('401:')) {
        router.push('/giris');
        return;
      }
      const msg = err instanceof Error ? err.message.replace(/^\d+:\s*/, '') : 'Durum güncellenemedi.';
      showToast('error', msg);
    } finally {
      setSaving(false);
    }
  };

  const confirmCancel = async () => {
    if (!cancelling) return;
    const cancelReason = cancelReasonDraft.trim();
    if (!cancelReason) {
      showToast('error', 'İptal açıklaması zorunlu.');
      return;
    }
    setSaving(true);
    const ok = await handleDurumChange(cancelling.id, 'cancelled', { cancelReason });
    setSaving(false);
    if (ok) {
      setCancelling(null);
      setCancelReasonDraft('');
    }
  };

  const handleNotifyOwner = async (req: InvoiceRequest) => {
    if (req.status !== 'invoiced') {
      showToast('error', 'Önce Faturalandı seçin ve satış fatura numarasını girin.');
      return;
    }
    try {
      const result = await notifyInvoiceRequestOwner(req.id);
      showToast(result.alreadyNotified ? 'info' : 'success', fileOwnerNotifyToast(result));
    } catch (err: unknown) {
      if (err instanceof Error && err.message.startsWith('401:')) {
        router.push('/giris');
        return;
      }
      const msg = err instanceof Error ? err.message.replace(/^\d+:\s*/, '') : 'Bildirim gönderilemedi.';
      showToast('error', msg);
    }
  };

  const sortValue = (row: InvoiceRequest, key: string) => {
    switch (key) {
      case 'tarih': return row.createdAt ?? '';
      case 'dosyaNo': return row.fileNo ?? '';
      case 'customer': return talepMusteri(row);
      case 'aciklama': return workItemsDescription(row);
      case 'tutar': return row.totalAmount ?? 0;
      case 'durum': return DURUM_LABEL[row.status] ?? row.status;
      default: return '';
    }
  };

  const filtered = filter === 'tumu' ? talepler : talepler.filter((t) => t.status === filter);
  const { hasar, acil } = partitionInvoiceRequests(filtered);
  const hasarSorted = sortRowsByClientSort(hasar, clientSort, sortValue);
  const acilSorted = sortRowsByClientSort(acil, clientSort, sortValue);
  const hasarTotalPages = Math.max(1, Math.ceil(hasarSorted.length / pageSize));
  const acilTotalPages = Math.max(1, Math.ceil(acilSorted.length / pageSize));
  const safeHasarPage = Math.min(hasarPage, hasarTotalPages);
  const safeAcilPage = Math.min(acilPage, acilTotalPages);
  const hasarPaged = hasarSorted.slice((safeHasarPage - 1) * pageSize, safeHasarPage * pageSize);
  const acilPaged = acilSorted.slice((safeAcilPage - 1) * pageSize, safeAcilPage * pageSize);
  const acilSelectableIds = acilSorted.filter(canSelectAcilInvoiceRequest).map((row) => row.id);
  const selectedAcilRows = acilSorted.filter((row) => selectedIds.has(row.id) && canSelectAcilInvoiceRequest(row));
  const selectedTotals = selectedAcilInvoiceTotals(selectedAcilRows);

  const toggleAcilRow = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAllAcil = () => {
    setSelectedIds((prev) => {
      const allOn = acilSelectableIds.length > 0 && acilSelectableIds.every((id) => prev.has(id));
      if (allOn) return new Set();
      return new Set(acilSelectableIds);
    });
  };

  const counts: Record<FilterKey, number> = {
    tumu: talepler.length,
    pending: talepler.filter((t) => t.status === 'pending').length,
    approved: talepler.filter((t) => t.status === 'approved').length,
    invoiced: talepler.filter((t) => t.status === 'invoiced').length,
    cancelled: talepler.filter((t) => t.status === 'cancelled').length,
  };

  return (
    <div className="space-y-4">
      <p className="inline-flex items-center gap-1.5 text-sm text-slate-500 dark:text-slate-400">
        Kesilmiş fatura değil; kapanıştan gelen kesilecek talep.
        <HintIcon text="Bu yazılım resmi fatura kesmez. Başka programda kesilen faturanın numarasını Resmi Fatura Gir ile yazın; iş Faturalandı görünür." />
      </p>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 px-4 py-3 rounded-xl text-sm">
          {error}
        </div>
      )}

      <div className="flex flex-wrap gap-1.5">
        {(['pending', 'approved', 'invoiced', 'cancelled', 'tumu'] as FilterKey[]).map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => { setFilter(k); setHasarPage(1); setAcilPage(1); }}
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
        <div className="space-y-4">
        <FaturaTalepListeKart
          title="Hasar Onarım"
          subtitle={`${hasarSorted.length} kayıt`}
          testId="fatura-talep-hasar-liste"
          rows={hasarPaged}
          total={hasarSorted.length}
          loading={loading}
          emptyTitle={filter === 'pending' ? 'Bekleyen hasar fatura işi yok.' : 'Hasar fatura talebi yok.'}
          emptyDescription="Onaylanan hasar dosyasının kesilecek işi burada durur."
          tableColumns={tableColumns}
          rowActions={rowActions}
          clientSort={clientSort}
          onClientSort={setClientSort}
          page={safeHasarPage}
          pageSize={pageSize}
          onPageChange={setHasarPage}
          onPageSizeChange={(size) => { setPageSize(size); setHasarPage(1); setAcilPage(1); }}
          talepMusteri={talepMusteri}
          workItemsDescription={workItemsDescription}
          fmtDate={fmtDate}
          onInvoice={openInvoicedModal}
          onView={setInspecting}
          onNotifyOwner={(row) => { void handleNotifyOwner(row); }}
          onCancel={(row) => { setCancelReasonDraft(''); setCancelling(row); }}
        />

        {selectedAcilRows.length > 0 ? (
          <div
            className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-brand-200 bg-brand-50 px-4 py-3 dark:border-brand-800 dark:bg-brand-950/40"
            data-testid="fatura-talep-acil-secim"
          >
            <div>
              <p className="text-sm font-medium text-slate-800 dark:text-slate-100">
                {selectedTotals.fileCount} Acil dosya seçildi
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Matrah {fmtCurrency(selectedTotals.net)} · KDV {fmtCurrency(selectedTotals.vat)} · Genel toplam {fmtCurrency(selectedTotals.gross)}
              </p>
            </div>
            <button
              type="button"
              data-testid="fatura-talep-toplu-fatura"
              onClick={() => openBulkInvoicedModal(selectedAcilRows)}
              className="rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-medium text-white"
            >
              Resmi Fatura Gir
            </button>
          </div>
        ) : null}

        <FaturaTalepListeKart
          title="Acil Yardım"
          subtitle={`${acilSorted.length} kayıt`}
          testId="fatura-talep-acil-liste"
          hint="Tek dosya veya birden fazla dosya aynı resmi faturada birleşir."
          rows={acilPaged}
          total={acilSorted.length}
          loading={loading}
          emptyTitle={filter === 'pending' ? 'Bekleyen acil fatura işi yok.' : 'Acil fatura talebi yok.'}
          emptyDescription="Kapanan acil dosyanın kesilecek işi burada durur."
          tableColumns={tableColumns}
          rowActions={rowActions}
          clientSort={clientSort}
          onClientSort={setClientSort}
          page={safeAcilPage}
          pageSize={pageSize}
          onPageChange={setAcilPage}
          onPageSizeChange={(size) => { setPageSize(size); setHasarPage(1); setAcilPage(1); }}
          selectable
          selectedIds={selectedIds}
          selectableIds={acilSelectableIds}
          onToggle={toggleAcilRow}
          onToggleAll={toggleAllAcil}
          talepMusteri={talepMusteri}
          workItemsDescription={workItemsDescription}
          fmtDate={fmtDate}
          onInvoice={openInvoicedModal}
          onView={setInspecting}
          onNotifyOwner={(row) => { void handleNotifyOwner(row); }}
          onCancel={(row) => { setCancelReasonDraft(''); setCancelling(row); }}
        />
        </div>
      </TableColumnsProvider>

      {inspecting ? (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Fatura Talebi"
          data-testid="fatura-talep-icerik"
        >
          <button
            type="button"
            className="absolute inset-0 bg-slate-950/30"
            aria-label="Kapat"
            onClick={() => setInspecting(null)}
          />
          <div className="relative max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-xl bg-white p-5 shadow-xl dark:bg-slate-800">
            <h2 className="text-[15px] font-medium text-slate-900 dark:text-white">Fatura Talebi</h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              {inspecting.fileNo} · {talepMusteri(inspecting)}
            </p>
            <dl className="mt-4 space-y-2 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-slate-500">Talep Tarihi</dt>
                <dd className="text-slate-800 dark:text-slate-100">{fmtDate(inspecting.createdAt)}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-slate-500">Hizmet</dt>
                <dd className="text-slate-800 dark:text-slate-100">{inspecting.serviceType === 'emergency' ? 'Acil Yardım' : 'Hasar Onarım'}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-slate-500">Durum</dt>
                <dd className="text-slate-800 dark:text-slate-100">{DURUM_LABEL[inspecting.status]}</dd>
              </div>
            </dl>
            <h3 className="mt-5 text-xs font-semibold text-slate-500">Yapılan İş Kalemi</h3>
            {invoiceRequestWorkItems(inspecting).length > 0 ? (
              <table className="mt-2 w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-slate-500">
                    <th className="py-1.5 font-medium">İş</th>
                    <th className="py-1.5 text-right font-medium">Tutar</th>
                  </tr>
                </thead>
                <tbody>
                  {invoiceRequestWorkItems(inspecting).map((item, i) => (
                    <tr key={`${item.description}-${i}`} className="border-t border-slate-100 dark:border-slate-700">
                      <td className="py-2 pr-3 text-slate-700 dark:text-slate-200">
                        {item.description || '—'}
                        {item.vatRate != null ? (
                          <span className="mt-0.5 block text-xs text-slate-400">KDV %{item.vatRate}</span>
                        ) : null}
                      </td>
                      <td className="py-2 text-right font-medium text-slate-800 dark:text-slate-100 whitespace-nowrap">
                        {fmtCurrency(item.amount ?? 0)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                İş Kalemi Kaydı Yok.
              </p>
            )}
            {inspecting.notes?.trim() ? (
              <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">
                <span className="text-slate-500">Not: </span>
                {inspecting.notes.trim()}
              </p>
            ) : null}
            <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3 dark:border-slate-700">
              <span className="text-sm text-slate-500">Toplam</span>
              <span className="text-sm font-semibold text-slate-900 dark:text-white">{fmtCurrency(inspecting.totalAmount)}</span>
            </div>
            <div className="mt-4 flex flex-wrap justify-end gap-2">
              {inspecting.status === 'pending' || inspecting.status === 'approved' ? (
                <button
                  type="button"
                  data-testid="fatura-talep-icerik-fatura-kes"
                  onClick={() => {
                    const row = inspecting;
                    setInspecting(null);
                    openInvoicedModal(row);
                  }}
                  className="rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-medium text-white"
                >
                  Resmi Fatura Gir
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => setInspecting(null)}
                className="rounded-lg px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50 dark:text-slate-300"
              >
                Kapat
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {invoicing.length > 0 ? (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Resmi fatura bilgisi"
          data-testid="fatura-talep-satis-no-modal"
        >
          <button
            type="button"
            className="absolute inset-0 bg-slate-950/30"
            aria-label="Kapat"
            onClick={() => {
              if (!saving) resetInvoiceDraft();
            }}
          />
          <div className="relative max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl bg-white p-5 shadow-xl dark:bg-slate-800">
            <h2 className="text-[15px] font-medium text-slate-900 dark:text-white">Resmi fatura bilgisi</h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Bu yazılım resmi fatura kesmez. Başka programda kesilen faturanın bilgilerini yazın.
              {invoicing.length === 1
                ? ` ${invoicing[0].fileNo} · ${fmtCurrency(invoicing[0].totalAmount)}`
                : ` ${invoicing.length} Acil dosya aynı faturada.`}
            </p>
            {invoicing.length > 1 ? (
              <ul className="mt-3 max-h-28 overflow-y-auto rounded-lg border border-slate-100 px-3 py-2 text-xs text-slate-600 dark:border-slate-700 dark:text-slate-300">
                {invoicing.map((row) => (
                  <li key={row.id} className="flex justify-between gap-3 py-0.5">
                    <span className="font-mono">{row.fileNo}</span>
                    <span>{fmtCurrency(row.totalAmount)}</span>
                  </li>
                ))}
              </ul>
            ) : null}
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <FinansFieldLabel required>Resmi fatura numarası</FinansFieldLabel>
                <input
                  autoFocus
                  value={invoiceNoDraft}
                  onChange={(e) => setInvoiceNoDraft(e.target.value)}
                  placeholder="Resmi fatura numarası"
                  className={finansInputClass}
                />
              </div>
              <div>
                <FinansFieldLabel required>Fatura tarihi</FinansFieldLabel>
                <input
                  type="date"
                  value={invoiceDateDraft}
                  onChange={(e) => setInvoiceDateDraft(e.target.value)}
                  className={finansInputClass}
                />
              </div>
              <div>
                <FinansFieldLabel>İşlem tarihi</FinansFieldLabel>
                <input
                  type="date"
                  value={documentDateDraft}
                  onChange={(e) => setDocumentDateDraft(e.target.value)}
                  className={finansInputClass}
                />
              </div>
              <div>
                <FinansFieldLabel>Matrah</FinansFieldLabel>
                <input
                  inputMode="decimal"
                  value={subtotalDraft}
                  onChange={(e) => setSubtotalDraft(e.target.value)}
                  className={finansInputClass}
                />
              </div>
              <div>
                <FinansFieldLabel>KDV</FinansFieldLabel>
                <input
                  inputMode="decimal"
                  value={vatDraft}
                  onChange={(e) => setVatDraft(e.target.value)}
                  className={finansInputClass}
                />
              </div>
              <div className="sm:col-span-2">
                <FinansFieldLabel>Genel toplam</FinansFieldLabel>
                <input
                  inputMode="decimal"
                  value={grossDraft}
                  onChange={(e) => setGrossDraft(e.target.value)}
                  className={finansInputClass}
                />
              </div>
            </div>
            <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
              Seçilen dosya hesabı: matrah {fmtCurrency(selectedAcilInvoiceTotals(invoicing).net)}, KDV {fmtCurrency(selectedAcilInvoiceTotals(invoicing).vat)}, genel toplam {fmtCurrency(selectedAcilInvoiceTotals(invoicing).gross)}.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                disabled={saving}
                onClick={() => resetInvoiceDraft()}
                className="rounded-lg px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-700"
              >
                Vazgeç
              </button>
              <button
                type="button"
                disabled={saving || !invoiceNoDraft.trim() || !invoiceDateDraft.trim()}
                onClick={() => void confirmInvoiced()}
                className="rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-40"
              >
                Faturalandı
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {cancelling ? (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Talep iptali"
          data-testid="fatura-talep-iptal-modal"
        >
          <button
            type="button"
            className="absolute inset-0 bg-slate-950/30"
            aria-label="Kapat"
            onClick={() => {
              if (!saving) {
                setCancelling(null);
                setCancelReasonDraft('');
              }
            }}
          />
          <div className="relative w-full max-w-md rounded-xl bg-white p-5 shadow-xl dark:bg-slate-800">
            <h2 className="text-[15px] font-medium text-slate-900 dark:text-white">Talebi İptal Et</h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              {cancelling.fileNo} · {talepMusteri(cancelling)}
            </p>
            <label className="mt-4 block text-xs font-medium text-slate-600 dark:text-slate-300">
              İptal Açıklaması
            </label>
            <textarea
              autoFocus
              required
              rows={4}
              value={cancelReasonDraft}
              onChange={(e) => setCancelReasonDraft(e.target.value)}
              placeholder="İptal nedenini yazın"
              className="mt-1.5 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
              data-testid="fatura-talep-iptal-aciklama"
            />
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                disabled={saving}
                onClick={() => {
                  setCancelling(null);
                  setCancelReasonDraft('');
                }}
                className="rounded-lg px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-700"
              >
                Vazgeç
              </button>
              <button
                type="button"
                disabled={saving || !cancelReasonDraft.trim()}
                onClick={() => void confirmCancel()}
                className="rounded-lg bg-red-600 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-40"
              >
                İptal Et
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
