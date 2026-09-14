'use client';

import type { ReactNode } from 'react';
import { InvoiceRequestRowActions, printFinanceSlip } from '@/components/finance/FinanceRowActions';
import { PortalRowActionsPicker } from '@/components/portal/PortalRowActionsPicker';
import { FINANS_FATURA_TALEP_ROW_ACTIONS } from '@/components/portal/portal-row-action-prefs';
import { usePortalRowActionPrefs } from '@/components/portal/use-portal-row-action-prefs';
import {
  PanelTableColumnPicker,
  PanelTableTh,
  PanelTableTd,
  SortablePanelTableTh,
  PanelTableColGroup,
  PanelTableScroll,
  PanelListToolbarPickers,
  panelTableLayoutStyle,
  usePanelTableColumns,
} from '@/components/ui/TableColumnPicker';
import { cycleClientSort, type ClientSortState } from '@/utils/panel-table-sort';
import { FinansEmptyState, FinansPanelCard } from '@/components/finance/FinansPanelUI';
import { FinansTablePager } from '@/components/finance/FinansTablePager';
import type { InvoiceRequest, InvoiceRequestStatus } from '@/utils/invoiceRequestApi';
import { FINANS_TABLE_PAGE_KEYS, type FinansTablePageSize } from '@/utils/finans-table-page';
import { canSelectAcilInvoiceRequest } from '@/utils/invoice-request-official';

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

function fmtCurrency(n: number) {
  return n.toLocaleString('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 0 });
}

export function FaturaTalepListeKart({
  title,
  subtitle,
  testId,
  hint,
  toolbar,
  rows,
  total,
  loading,
  emptyTitle,
  emptyDescription,
  tableColumns,
  rowActions,
  clientSort,
  onClientSort,
  page,
  pageSize,
  onPageChange,
  onPageSizeChange,
  selectable,
  selectedIds,
  selectableIds,
  onToggle,
  onToggleAll,
  talepMusteri,
  workItemsDescription,
  fmtDate,
  onInvoice,
  onView,
  onNotifyOwner,
  onCancel,
}: {
  title: string;
  subtitle: string;
  testId: string;
  hint?: string;
  toolbar?: ReactNode;
  rows: InvoiceRequest[];
  total: number;
  loading: boolean;
  emptyTitle: string;
  emptyDescription: string;
  tableColumns: ReturnType<typeof usePanelTableColumns>;
  rowActions: ReturnType<typeof usePortalRowActionPrefs>;
  clientSort: ClientSortState;
  onClientSort: (next: ClientSortState) => void;
  page: number;
  pageSize: FinansTablePageSize;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: FinansTablePageSize) => void;
  selectable?: boolean;
  selectedIds?: Set<string>;
  selectableIds?: string[];
  onToggle?: (id: string) => void;
  onToggleAll?: () => void;
  talepMusteri: (row: InvoiceRequest) => string;
  workItemsDescription: (row: InvoiceRequest) => string;
  fmtDate: (value: string) => string;
  onInvoice: (row: InvoiceRequest) => void;
  onView: (row: InvoiceRequest) => void;
  onNotifyOwner: (row: InvoiceRequest) => void;
  onCancel: (row: InvoiceRequest) => void;
}) {
  const leadingWidths = selectable ? [40] : [];
  const ids = selectableIds ?? [];
  const allSelected = ids.length > 0 && ids.every((id) => selectedIds?.has(id));

  return (
    <FinansPanelCard title={title} subtitle={subtitle} noPadding>
      <div className="px-4 py-2 border-b border-slate-100 dark:border-slate-700 flex flex-wrap items-center justify-between gap-2">
        {hint ? <p className="text-xs text-slate-500 dark:text-slate-400">{hint}</p> : <span />}
        <div className="flex items-center gap-2">
          {toolbar}
          <PanelListToolbarPickers>
            <PanelTableColumnPicker tableColumns={tableColumns} />
            <PortalRowActionsPicker
              catalog={FINANS_FATURA_TALEP_ROW_ACTIONS}
              pinnedIds={rowActions.pinnedIds}
              onToggle={rowActions.toggle}
              onReset={rowActions.reset}
            />
          </PanelListToolbarPickers>
        </div>
      </div>
      {loading ? (
        <div className="animate-pulse p-6 space-y-3">
          {[...Array(5)].map((_, i) => <div key={i} className="h-10 bg-slate-100 dark:bg-slate-700 rounded" />)}
        </div>
      ) : rows.length === 0 ? (
        <div className="p-4">
          <FinansEmptyState title={emptyTitle} description={emptyDescription} />
        </div>
      ) : (
        <PanelTableScroll>
          <table className="text-sm" data-testid={testId} style={panelTableLayoutStyle(tableColumns, { leadingWidths })}>
            <PanelTableColGroup leadingWidths={leadingWidths} />
            <thead className="bg-slate-50 dark:bg-slate-700/40 border-b border-slate-100 dark:border-slate-700">
              <tr>
                {selectable ? (
                  <th className="px-3 py-3 text-center w-10">
                    <input
                      type="checkbox"
                      checked={allSelected}
                      onChange={onToggleAll}
                      aria-label="Acil dosyaları seç"
                      data-testid="fatura-talep-acil-tumunu-sec"
                    />
                  </th>
                ) : null}
                {tableColumns.prefs.orderedVisibleColumns.map((col) => {
                  const thClass = 'px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 text-center';
                  if (col.id === 'actions') {
                    return (
                      <PanelTableTh key={col.id} colId={col.id} className="px-2 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 text-center" resizable={false}>
                        {col.label}
                      </PanelTableTh>
                    );
                  }
                  return (
                    <SortablePanelTableTh
                      key={col.id}
                      colId={col.id}
                      sortKey={col.id}
                      activeSortKey={clientSort?.key ?? null}
                      sortDir={clientSort?.dir ?? 'asc'}
                      onSort={(k) => onClientSort(cycleClientSort(clientSort, k))}
                      className={thClass}
                    >
                      {col.label}
                    </SortablePanelTableTh>
                  );
                })}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 dark:divide-slate-700/50">
              {rows.map((t, idx) => (
                <tr key={t.id} className={`hover:bg-slate-50/70 dark:hover:bg-slate-700/40 transition-colors ${idx % 2 !== 0 ? 'bg-slate-50/30' : ''} ${selectedIds?.has(t.id) ? 'bg-brand-50/60 dark:bg-brand-900/20' : ''}`}>
                  {selectable ? (
                    <td className="px-3 py-3 text-center">
                      {canSelectAcilInvoiceRequest(t) ? (
                        <input
                          type="checkbox"
                          checked={selectedIds?.has(t.id) ?? false}
                          onChange={() => onToggle?.(t.id)}
                          aria-label={`${t.fileNo} seç`}
                        />
                      ) : null}
                    </td>
                  ) : null}
                  {tableColumns.prefs.orderedVisibleColumns.map((col) => {
                    switch (col.id) {
                      case 'tarih':
                        return <PanelTableTd key={col.id} colId="tarih" className="px-4 py-3 text-xs text-slate-500 dark:text-slate-400">{fmtDate(t.createdAt)}</PanelTableTd>;
                      case 'dosyaNo':
                        return (
                          <PanelTableTd key={col.id} colId="dosyaNo" className="px-4 py-3" title={t.fileNo}>
                            <span className="text-xs font-mono font-semibold text-brand-600 dark:text-blue-400">{t.fileNo}</span>
                          </PanelTableTd>
                        );
                      case 'customer':
                        return <PanelTableTd key={col.id} colId="customer" className="px-4 py-3 text-slate-700 dark:text-slate-200 font-medium">{talepMusteri(t)}</PanelTableTd>;
                      case 'aciklama':
                        return (
                          <PanelTableTd key={col.id} colId="aciklama" className="px-4 py-3 text-slate-500 dark:text-slate-400 text-xs">
                            {workItemsDescription(t)}
                          </PanelTableTd>
                        );
                      case 'tutar':
                        return <PanelTableTd key={col.id} colId="tutar" className="px-4 py-3 text-right font-semibold text-slate-800 dark:text-slate-100">{fmtCurrency(t.totalAmount)}</PanelTableTd>;
                      case 'durum':
                        return (
                          <PanelTableTd key={col.id} colId="durum" className="px-4 py-3">
                            <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-medium ${DURUM_COLOR[t.status]}`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${DURUM_DOT[t.status]}`} />
                              {DURUM_LABEL[t.status]}
                            </span>
                          </PanelTableTd>
                        );
                      case 'actions':
                        return (
                          <PanelTableTd key={col.id} colId="actions" className="px-2 py-3">
                            <InvoiceRequestRowActions
                              rowId={t.id}
                              pinnedIds={rowActions.pinnedIds}
                              status={t.status}
                              onInvoice={t.status === 'pending' || t.status === 'approved' ? () => onInvoice(t) : undefined}
                              onView={() => onView(t)}
                              onPrint={() => printFinanceSlip({
                                title: `Fatura talebi ${t.fileNo}`,
                                fileNo: t.fileNo,
                                customer: talepMusteri(t),
                                date: fmtDate(t.createdAt),
                                amount: t.totalAmount ?? 0,
                                status: DURUM_LABEL[t.status],
                                note: workItemsDescription(t),
                              })}
                              onNotifyOwner={t.status === 'invoiced' ? () => onNotifyOwner(t) : undefined}
                              onCancel={t.status === 'cancelled' ? undefined : () => onCancel(t)}
                            />
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
        </PanelTableScroll>
      )}
      {!loading && total > 0 ? (
        <FinansTablePager
          page={page}
          pageSize={pageSize}
          total={total}
          storageKey={FINANS_TABLE_PAGE_KEYS.talepler}
          onPageChange={onPageChange}
          onPageSizeChange={onPageSizeChange}
        />
      ) : null}
    </FinansPanelCard>
  );
}
