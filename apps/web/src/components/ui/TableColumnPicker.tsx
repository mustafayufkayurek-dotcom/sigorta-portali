'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

export interface TableColumnDef {
  id: string;
  label: string;
  defaultVisible?: boolean;
  defaultWidth?: number;
  minWidth?: number;
  resizable?: boolean;
}

export function useTableColumnPrefs(storageKey: string, columns: TableColumnDef[]) {
  const defaultVisible = columns
    .filter((c) => c.defaultVisible !== false)
    .map((c) => c.id);

  const [visibleIds, setVisibleIds] = useState<string[]>(defaultVisible);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const parsed = JSON.parse(raw) as string[];
        const valid = parsed.filter((id) => columns.some((c) => c.id === id));
        if (valid.length > 0) {
          setVisibleIds(valid);
        }
      }
    } catch {
      // ignore
    } finally {
      setReady(true);
    }
  }, [storageKey, columns]);

  const toggle = useCallback(
    (id: string) => {
      setVisibleIds((prev) => {
        const has = prev.includes(id);
        const next = has ? prev.filter((x) => x !== id) : [...prev, id];
        if (next.length === 0) return prev;
        localStorage.setItem(storageKey, JSON.stringify(next));
        return next;
      });
    },
    [storageKey],
  );

  const reset = useCallback(() => {
    setVisibleIds(defaultVisible);
    localStorage.setItem(storageKey, JSON.stringify(defaultVisible));
  }, [defaultVisible, storageKey]);

  const isVisible = useCallback((id: string) => visibleIds.includes(id), [visibleIds]);

  return { visibleIds, isVisible, toggle, reset, ready };
}

function buildDefaultWidths(columns: TableColumnDef[]): Record<string, number> {
  return Object.fromEntries(
    columns.map((c) => [c.id, c.defaultWidth ?? 140]),
  );
}

export function useTableColumnWidths(storageKey: string, columns: TableColumnDef[]) {
  const defaults = buildDefaultWidths(columns);
  const [widths, setWidths] = useState<Record<string, number>>(defaults);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(`${storageKey}:widths`);
      if (!raw) return;
      const parsed = JSON.parse(raw) as Record<string, number>;
      const next = { ...defaults };
      for (const col of columns) {
        const w = parsed[col.id];
        if (typeof w === 'number' && w >= (col.minWidth ?? 72)) {
          next[col.id] = w;
        }
      }
      setWidths(next);
    } catch {
      // ignore
    }
  }, [storageKey, columns]);

  const setWidth = useCallback(
    (id: string, width: number) => {
      const col = columns.find((c) => c.id === id);
      const min = col?.minWidth ?? 72;
      const nextW = Math.max(min, Math.round(width));
      setWidths((prev) => {
        const next = { ...prev, [id]: nextW };
        localStorage.setItem(`${storageKey}:widths`, JSON.stringify(next));
        return next;
      });
    },
    [columns, storageKey],
  );

  const resetWidths = useCallback(() => {
    setWidths(defaults);
    localStorage.setItem(`${storageKey}:widths`, JSON.stringify(defaults));
  }, [defaults, storageKey]);

  const getWidth = useCallback(
    (id: string) => widths[id] ?? defaults[id] ?? 140,
    [widths, defaults],
  );

  return { widths, getWidth, setWidth, resetWidths, defaults };
}

interface ResizableThProps {
  colId: string;
  width: number;
  minWidth?: number;
  defaultWidth?: number;
  onResize: (id: string, width: number) => void;
  className?: string;
  children: ReactNode;
  resizable?: boolean;
}

export function ResizableTh({
  colId,
  width,
  minWidth = 72,
  defaultWidth,
  onResize,
  className = '',
  children,
  resizable = true,
}: ResizableThProps) {
  const startResize = (e: React.MouseEvent) => {
    if (!resizable) return;
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const startW = width;

    const onMove = (ev: MouseEvent) => {
      onResize(colId, Math.max(minWidth, startW + ev.clientX - startX));
    };
    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  };

  return (
    <th
      style={{ width, minWidth: width, maxWidth: width }}
      className={`group relative select-none ${className}`}
    >
      <span className="block truncate pr-3">{children}</span>
      {resizable && (
        <span
          role="separator"
          aria-orientation="vertical"
          aria-label="Sütun genişliğini ayarla"
          title="Sürükleyerek genişlet/daralt — çift tıkla varsayılan"
          onMouseDown={startResize}
          onDoubleClick={(e) => {
            e.stopPropagation();
            onResize(colId, defaultWidth ?? width);
          }}
          className="absolute -right-0.5 top-0 z-20 flex h-full w-4 cursor-col-resize touch-none items-stretch justify-center"
        >
          <span className="my-1 w-0.5 rounded-full bg-slate-200 transition-colors group-hover:bg-blue-400 dark:bg-slate-600 dark:group-hover:bg-blue-400" />
        </span>
      )}
    </th>
  );
}

interface TableColumnPickerProps {
  columns: TableColumnDef[];
  visibleIds: string[];
  onToggle: (id: string) => void;
  onReset: () => void;
  onResetWidths?: () => void;
}

export function TableColumnPicker({
  columns,
  visibleIds,
  onToggle,
  onReset,
  onResetWidths,
}: TableColumnPickerProps) {
  const [open, setOpen] = useState(false);

  const resetAll = () => {
    onReset();
    onResetWidths?.();
    setOpen(false);
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-600 px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700"
      >
        <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h10M4 18h6" />
        </svg>
        Sütunlar
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-20" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-30 mt-1 w-56 rounded-xl border border-slate-200 bg-white p-2 shadow-lg dark:border-slate-600 dark:bg-slate-800">
            <p className="px-2 py-1 text-[11px] font-semibold text-slate-400">Görünür sütunlar</p>
            {columns.map((col) => (
              <label
                key={col.id}
                className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-slate-50 dark:hover:bg-slate-700/50"
              >
                <input
                  type="checkbox"
                  checked={visibleIds.includes(col.id)}
                  onChange={() => onToggle(col.id)}
                  className="rounded border-slate-300"
                />
                <span className="text-slate-700 dark:text-slate-200">{col.label}</span>
              </label>
            ))}
            <p className="mt-2 border-t border-slate-100 px-2 pt-2 text-[10px] leading-4 text-slate-400 dark:border-slate-700">
              Sütun başlığının sağ kenarından sürükleyerek genişletin veya daraltın.
            </p>
            <button
              type="button"
              onClick={resetAll}
              className="mt-1 w-full rounded-lg px-2 py-1.5 text-left text-xs text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-900/20"
            >
              Varsayılana dön (görünüm + genişlik)
            </button>
          </div>
        </>
      )}
    </div>
  );
}

export function tableCellStyle(width: number) {
  return { width, minWidth: width, maxWidth: width };
}

// ── Panel tablo context (sütun göster/gizle + genişlik) ─────────────────────

export interface PanelTableColumnsValue {
  storageKey: string;
  columns: TableColumnDef[];
  prefs: ReturnType<typeof useTableColumnPrefs>;
  widths: ReturnType<typeof useTableColumnWidths>;
  resetAll: () => void;
}

const TableColumnsContext = createContext<PanelTableColumnsValue | null>(null);

export function usePanelTableColumns(storageKey: string, columns: TableColumnDef[]) {
  const prefs = useTableColumnPrefs(storageKey, columns);
  const widths = useTableColumnWidths(storageKey, columns);
  const resetAll = useCallback(() => {
    prefs.reset();
    widths.resetWidths();
  }, [prefs, widths]);
  return useMemo(
    () => ({ storageKey, columns, prefs, widths, resetAll }),
    [storageKey, columns, prefs, widths, resetAll],
  );
}

export function TableColumnsProvider({
  value,
  children,
}: {
  value: PanelTableColumnsValue;
  children: ReactNode;
}) {
  return <TableColumnsContext.Provider value={value}>{children}</TableColumnsContext.Provider>;
}

function useTableColumnsCtx(): PanelTableColumnsValue | null {
  return useContext(TableColumnsContext);
}

function colMeta(ctx: PanelTableColumnsValue, colId: string) {
  return ctx.columns.find((c) => c.id === colId);
}

export function PanelTableColumnPicker({ tableColumns }: { tableColumns: PanelTableColumnsValue }) {
  return (
    <TableColumnPicker
      columns={tableColumns.columns}
      visibleIds={tableColumns.prefs.visibleIds}
      onToggle={tableColumns.prefs.toggle}
      onReset={tableColumns.prefs.reset}
      onResetWidths={tableColumns.widths.resetWidths}
    />
  );
}

interface PanelTableThProps {
  colId: string;
  className?: string;
  children: ReactNode;
  resizable?: boolean;
}

export function PanelTableTh({ colId, className = '', children, resizable = true }: PanelTableThProps) {
  const ctx = useTableColumnsCtx();
  if (ctx && !ctx.prefs.isVisible(colId)) return null;
  if (!ctx) {
    return <th className={className}>{children}</th>;
  }
  const meta = colMeta(ctx, colId);
  return (
    <ResizableTh
      colId={colId}
      width={ctx.widths.getWidth(colId)}
      minWidth={meta?.minWidth ?? 72}
      defaultWidth={meta?.defaultWidth ?? 140}
      onResize={ctx.widths.setWidth}
      className={className}
      resizable={resizable && meta?.resizable !== false}
    >
      {children}
    </ResizableTh>
  );
}

interface PanelTableTdProps {
  colId: string;
  className?: string;
  children: ReactNode;
  title?: string;
}

export function PanelTableTd({ colId, className = '', children, title }: PanelTableTdProps) {
  const ctx = useTableColumnsCtx();
  if (ctx && !ctx.prefs.isVisible(colId)) return null;
  const width = ctx?.widths.getWidth(colId);
  return (
    <td
      className={`${className.includes('table-td-center') ? '' : 'truncate'} ${className}`}
      style={width ? tableCellStyle(width) : undefined}
      title={title}
    >
      {children}
    </td>
  );
}

interface SortablePanelTableThProps extends PanelTableThProps {
  sortKey: string;
  activeSortKey: string | null;
  sortDir: 'asc' | 'desc';
  onSort: (key: string) => void;
  right?: boolean;
}

export function SortablePanelTableTh({
  colId,
  className = '',
  children,
  sortKey,
  activeSortKey,
  sortDir,
  onSort,
  right,
  resizable = true,
}: SortablePanelTableThProps) {
  const active = activeSortKey === sortKey;
  const label = (
    <span
      role="button"
      tabIndex={0}
      className={`inline-flex items-center gap-1 cursor-pointer hover:text-slate-700 dark:hover:text-slate-200 ${right ? 'justify-end w-full' : ''}`}
      onClick={() => onSort(sortKey)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSort(sortKey);
        }
      }}
    >
      {children}
      <span className={`transition-opacity ${active ? 'opacity-100 text-blue-600 dark:text-blue-400' : 'opacity-30'}`}>
        {active && sortDir === 'desc' ? '↓' : '↑'}
      </span>
    </span>
  );
  return (
    <PanelTableTh colId={colId} className={className} resizable={resizable}>
      {label}
    </PanelTableTh>
  );
}

export function panelTableLayoutStyle(tableColumns: PanelTableColumnsValue) {
  const total = tableColumns.prefs.visibleIds.reduce(
    (sum, id) => sum + tableColumns.widths.getWidth(id),
    72,
  );
  return { tableLayout: 'fixed' as const, width: '100%', minWidth: `${total}px` };
}

interface PanelTableSummaryFootProps {
  tableColumns: PanelTableColumnsValue;
  valueColId: string;
  value: ReactNode;
  label?: string;
  actionColWidth?: number;
  rowClassName?: string;
  labelClassName?: string;
  valueClassName?: string;
}

/** Toplam satırı — görünür sütun sırasına göre hizalanır (colSpan kayması olmaz). */
export function PanelTableSummaryFoot({
  tableColumns,
  valueColId,
  value,
  label = 'Toplam',
  actionColWidth = 72,
  rowClassName = 'border-t-2 border-slate-200 dark:border-slate-600 bg-slate-50/70 dark:bg-slate-700/40',
  labelClassName = 'px-5 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400',
  valueClassName = 'px-5 py-3 text-right font-bold text-slate-900 dark:text-slate-100',
}: PanelTableSummaryFootProps) {
  const visible = tableColumns.columns.filter((c) => tableColumns.prefs.isVisible(c.id));
  const labelColId = visible[0]?.id;
  let labelShown = false;

  return (
    <tfoot>
      <tr className={rowClassName}>
        {visible.map((col) => {
          const style = tableCellStyle(tableColumns.widths.getWidth(col.id));
          if (col.id === valueColId) {
            return (
              <td key={col.id} style={style} className={valueClassName}>
                {value}
              </td>
            );
          }
          if (col.id === labelColId && !labelShown) {
            labelShown = true;
            return (
              <td key={col.id} style={style} className={labelClassName}>
                {label}
              </td>
            );
          }
          return <td key={col.id} style={style} className="px-5 py-3" />;
        })}
        <td
          style={{ width: actionColWidth, minWidth: actionColWidth, maxWidth: actionColWidth }}
          className="px-5 py-3"
        />
      </tr>
    </tfoot>
  );
}
