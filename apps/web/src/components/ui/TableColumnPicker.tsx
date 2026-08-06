'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type DragEvent,
  type ReactNode,
} from 'react';

export interface TableColumnDef {
  id: string;
  label: string;
  defaultVisible?: boolean;
  defaultWidth?: number;
  minWidth?: number;
  resizable?: boolean;
  /** Kalan tablo genişliğini doldurur (colgroup width atanmaz) */
  flex?: boolean;
  /** Sağda sabit kalır (ör. İşlemler) — sürüklenmez, sıranın sonuna kilitlenir */
  pin?: 'end';
}

export function useTableColumnPrefs(storageKey: string, columns: TableColumnDef[]) {
  const defaultOrder = columns.map((c) => c.id);
  const defaultVisible = columns
    .filter((c) => c.defaultVisible !== false)
    .map((c) => c.id);

  const [visibleIds, setVisibleIds] = useState<string[]>(defaultVisible);
  const [columnOrder, setColumnOrder] = useState<string[]>(defaultOrder);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const rawVisible = localStorage.getItem(storageKey);
      if (rawVisible) {
        const parsed = JSON.parse(rawVisible) as string[];
        const valid = parsed.filter((id) => columns.some((c) => c.id === id));
        // Yeni eklenen varsayılan sütunlar eski tercihte yoksa görünür hale getir
        const missingDefaults = columns
          .filter((c) => c.defaultVisible !== false && !valid.includes(c.id))
          .map((c) => c.id);
        if (valid.length > 0) {
          const merged = [...valid, ...missingDefaults];
          setVisibleIds(merged);
          if (missingDefaults.length > 0) {
            localStorage.setItem(storageKey, JSON.stringify(merged));
          }
        }
      }
      const rawOrder = localStorage.getItem(`${storageKey}:order`);
      if (rawOrder) {
        const parsedOrder = JSON.parse(rawOrder) as string[];
        const known = new Set(columns.map((c) => c.id));
        const pinnedEnd = new Set(columns.filter((c) => c.pin === 'end').map((c) => c.id));
        const validOrder = parsedOrder.filter((id) => known.has(id));
        const missing = columns.map((c) => c.id).filter((id) => !validOrder.includes(id));
        if (validOrder.length > 0) {
          const merged = [...validOrder, ...missing];
          const unlocked = merged.filter((id) => !pinnedEnd.has(id));
          const pinned = columns.map((c) => c.id).filter((id) => pinnedEnd.has(id) && merged.includes(id));
          setColumnOrder([...unlocked, ...pinned]);
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

  const pinnedEndIds = useMemo(
    () => new Set(columns.filter((c) => c.pin === 'end').map((c) => c.id)),
    [columns],
  );

  const normalizeOrder = useCallback(
    (order: string[]) => {
      const unlocked = order.filter((id) => !pinnedEndIds.has(id));
      const pinned = columns.map((c) => c.id).filter((id) => pinnedEndIds.has(id) && order.includes(id));
      const missingPinned = columns.map((c) => c.id).filter((id) => pinnedEndIds.has(id) && !order.includes(id));
      return [...unlocked, ...pinned, ...missingPinned];
    },
    [columns, pinnedEndIds],
  );

  const moveColumn = useCallback(
    (id: string, direction: -1 | 1) => {
      if (pinnedEndIds.has(id)) return;
      setColumnOrder((prev) => {
        const working = prev.filter((x) => !pinnedEndIds.has(x));
        const idx = working.indexOf(id);
        if (idx < 0) return prev;
        const swapIdx = idx + direction;
        if (swapIdx < 0 || swapIdx >= working.length) return prev;
        const nextWorking = [...working];
        [nextWorking[idx], nextWorking[swapIdx]] = [nextWorking[swapIdx], nextWorking[idx]];
        const next = normalizeOrder(nextWorking);
        localStorage.setItem(`${storageKey}:order`, JSON.stringify(next));
        return next;
      });
    },
    [normalizeOrder, pinnedEndIds, storageKey],
  );

  const reset = useCallback(() => {
    setVisibleIds(defaultVisible);
    setColumnOrder(defaultOrder);
    localStorage.setItem(storageKey, JSON.stringify(defaultVisible));
    localStorage.setItem(`${storageKey}:order`, JSON.stringify(defaultOrder));
  }, [defaultOrder, defaultVisible, storageKey]);

  const isVisible = useCallback((id: string) => visibleIds.includes(id), [visibleIds]);

  const orderedVisibleColumns = useMemo(() => {
    const normalized = normalizeOrder(columnOrder);
    return normalized
      .filter((id) => visibleIds.includes(id))
      .map((id) => columns.find((c) => c.id === id))
      .filter((c): c is TableColumnDef => Boolean(c));
  }, [columnOrder, columns, normalizeOrder, visibleIds]);

  const reorderColumn = useCallback(
    (fromId: string, toId: string) => {
      if (fromId === toId) return;
      if (pinnedEndIds.has(fromId) || pinnedEndIds.has(toId)) return;
      setColumnOrder((prev) => {
        const working = prev.filter((x) => !pinnedEndIds.has(x));
        const fromIdx = working.indexOf(fromId);
        const toIdx = working.indexOf(toId);
        if (fromIdx < 0 || toIdx < 0) return prev;
        const nextWorking = [...working];
        nextWorking.splice(fromIdx, 1);
        nextWorking.splice(toIdx, 0, fromId);
        const next = normalizeOrder(nextWorking);
        localStorage.setItem(`${storageKey}:order`, JSON.stringify(next));
        return next;
      });
    },
    [normalizeOrder, pinnedEndIds, storageKey],
  );

  return { visibleIds, columnOrder, orderedVisibleColumns, isVisible, toggle, moveColumn, reorderColumn, reset, ready };
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
  fitLabel?: string;
  fitSamples?: string[];
  onResize: (id: string, width: number) => void;
  className?: string;
  children: ReactNode;
  resizable?: boolean;
  dragProps?: {
    draggable: boolean;
    onDragStart: (e: DragEvent) => void;
    onDragOver: (e: DragEvent) => void;
    onDrop: (e: DragEvent) => void;
    onDragEnd: () => void;
    className?: string;
  };
}

export function ResizableTh({
  colId,
  width,
  minWidth = 72,
  defaultWidth,
  fitLabel,
  fitSamples,
  onResize,
  className = '',
  children,
  resizable = true,
  dragProps,
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

  const dragClassName = dragProps && 'className' in dragProps ? dragProps.className : undefined;
  const restDragProps = dragProps
    ? {
        draggable: dragProps.draggable,
        onDragStart: dragProps.onDragStart,
        onDragOver: dragProps.onDragOver,
        onDrop: dragProps.onDrop,
        onDragEnd: dragProps.onDragEnd,
      }
    : undefined;
  return (
    <th
      style={{ width, minWidth: width, maxWidth: width }}
      className={`group relative box-border select-none overflow-hidden !text-center ${className} ${dragClassName ?? ''}`.trim()}
      {...restDragProps}
    >
      <span className={`flex min-w-0 items-center justify-center truncate px-1 pr-3 ${dragProps ? 'cursor-grab active:cursor-grabbing' : ''}`}>
        {children}
      </span>
      {resizable && (
        <span
          role="separator"
          aria-orientation="vertical"
          aria-label="Sütun genişliğini ayarla"
          title="Sürükleyerek genişlet/daralt — çift tıkla varsayılan"
          onMouseDown={(e) => {
            e.stopPropagation();
            startResize(e);
          }}
          onDoubleClick={(e) => {
            e.stopPropagation();
            const label = fitLabel ?? colId;
            onResize(colId, estimateColumnContentWidth(label, minWidth, defaultWidth ?? width, fitSamples));
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
  columnOrder: string[];
  storageKey?: string;
  widths?: Record<string, number>;
  onToggle: (id: string) => void;
  onMoveColumn: (id: string, direction: -1 | 1) => void;
  onReorderColumn?: (fromId: string, toId: string) => void;
  onReset: () => void;
  onResetWidths?: () => void;
}

export function estimateColumnContentWidth(
  label: string,
  minWidth: number,
  defaultWidth?: number,
  samples: string[] = [],
): number {
  const candidates = [label, ...samples].filter(Boolean);
  const charBased = Math.max(
    ...candidates.map((text) => Math.round(String(text).length * 8.5 + 44)),
    Math.round(label.length * 8.5 + 44),
  );
  const base = defaultWidth ?? minWidth;
  return Math.min(440, Math.max(minWidth, base, charBased));
}

export function TableColumnPicker({
  columns,
  visibleIds,
  columnOrder,
  storageKey,
  widths,
  onToggle,
  onMoveColumn,
  onReorderColumn,
  onReset,
  onResetWidths,
}: TableColumnPickerProps) {
  const [open, setOpen] = useState(false);
  const [dragId, setDragId] = useState<string | null>(null);
  const [savedFlash, setSavedFlash] = useState(false);
  const [menuPos, setMenuPos] = useState<{ top: number; right: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement | null>(null);

  const resetAll = () => {
    onReset();
    onResetWidths?.();
    setOpen(false);
  };

  const saveView = () => {
    if (!storageKey) {
      setOpen(false);
      return;
    }
    try {
      localStorage.setItem(storageKey, JSON.stringify(visibleIds));
      localStorage.setItem(`${storageKey}:order`, JSON.stringify(columnOrder));
      if (widths) {
        localStorage.setItem(`${storageKey}:widths`, JSON.stringify(widths));
      }
      setSavedFlash(true);
      window.setTimeout(() => setSavedFlash(false), 1200);
    } catch {
      // ignore
    }
  };

  const openMenu = () => {
    const next = !open;
    if (next && btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect();
      const menuHeight = 420;
      const spaceBelow = window.innerHeight - rect.bottom - 8;
      const top =
        spaceBelow >= Math.min(menuHeight, 280)
          ? Math.round(rect.bottom + 4)
          : Math.max(8, Math.round(rect.top - Math.min(menuHeight, spaceBelow > 120 ? spaceBelow : menuHeight) - 4));
      setMenuPos({
        top,
        right: Math.round(window.innerWidth - rect.right),
      });
    }
    setOpen(next);
  };

  return (
    <div className="relative">
      <button
        ref={btnRef}
        type="button"
        onClick={openMenu}
        data-testid="table-columns-btn"
        aria-expanded={open}
        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-600 px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700"
      >
        <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h10M4 18h6" />
        </svg>
        Sütunlar
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-[80]" onClick={() => setOpen(false)} />
          <div
            className="fixed z-[90] max-h-[min(420px,calc(100vh-24px))] w-64 overflow-y-auto rounded-xl border border-slate-200 bg-white p-2 shadow-lg dark:border-slate-600 dark:bg-slate-800"
            data-testid="table-columns-menu"
            role="menu"
            style={{
              top: menuPos?.top ?? 0,
              right: menuPos?.right ?? 16,
            }}
          >
            <p className="px-2 py-1 text-[11px] font-semibold text-slate-400">Görünür sütunlar</p>
            <p className="px-2 pb-1 text-[10px] leading-4 text-slate-400">
              Sıralamak için satırı sürükleyin veya ↑ ↓ kullanın. İşlemler sağda sabit kalır.
            </p>
            {columnOrder.map((id) => {
              const col = columns.find((c) => c.id === id);
              if (!col) return null;
              const visible = visibleIds.includes(id);
              const pinned = col.pin === 'end';
              const movableOrder = columnOrder.filter((cid) => columns.find((c) => c.id === cid)?.pin !== 'end');
              const orderIndex = movableOrder.indexOf(id);
              return (
              <div
                key={col.id}
                draggable={Boolean(onReorderColumn) && !pinned}
                onDragStart={(e) => {
                  if (pinned) {
                    e.preventDefault();
                    return;
                  }
                  e.dataTransfer.setData('text/plain', col.id);
                  e.dataTransfer.effectAllowed = 'move';
                  setDragId(col.id);
                }}
                onDragOver={(e) => {
                  if (!onReorderColumn || pinned) return;
                  e.preventDefault();
                  e.dataTransfer.dropEffect = 'move';
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  if (pinned) return;
                  const fromId = dragId || e.dataTransfer.getData('text/plain');
                  if (fromId && onReorderColumn && fromId !== col.id) {
                    onReorderColumn(fromId, col.id);
                  }
                  setDragId(null);
                }}
                onDragEnd={() => setDragId(null)}
                className={`flex items-center gap-1 rounded-lg px-1 py-0.5 hover:bg-slate-50 dark:hover:bg-slate-700/50 ${dragId === col.id ? 'opacity-50' : ''} ${pinned ? '' : 'cursor-grab active:cursor-grabbing'}`}
              >
                <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 px-1 py-1 text-sm">
                  <input
                    type="checkbox"
                    checked={visible}
                    onChange={() => onToggle(col.id)}
                    className="rounded border-slate-300"
                    disabled={pinned}
                  />
                  <span className="truncate text-slate-700 dark:text-slate-200">
                    {col.label}
                    {pinned ? <span className="ml-1 text-[10px] text-slate-400">(Sabit)</span> : null}
                  </span>
                </label>
                <button
                  type="button"
                  disabled={pinned || orderIndex <= 0}
                  onClick={() => onMoveColumn(col.id, -1)}
                  className="rounded px-1 text-xs text-slate-400 hover:text-slate-700 disabled:opacity-30 dark:hover:text-slate-200"
                  title="Sola taşı"
                  aria-label={`${col.label} sola taşı`}
                >
                  ↑
                </button>
                <button
                  type="button"
                  disabled={pinned || orderIndex < 0 || orderIndex >= movableOrder.length - 1}
                  onClick={() => onMoveColumn(col.id, 1)}
                  className="rounded px-1 text-xs text-slate-400 hover:text-slate-700 disabled:opacity-30 dark:hover:text-slate-200"
                  title="Sağa taşı"
                  aria-label={`${col.label} sağa taşı`}
                >
                  ↓
                </button>
              </div>
            );
            })}
            <p className="mt-2 border-t border-slate-100 px-2 pt-2 text-[10px] leading-4 text-slate-400 dark:border-slate-700">
              Sütun sırası: tablo başlığını sürükleyerek veya buradan değiştirin. Genişlik: başlık kenarından sürükleyin.
            </p>
            <button
              type="button"
              onClick={saveView}
              data-testid="table-view-save"
              className="mt-1 w-full rounded-lg px-2 py-1.5 text-left text-xs font-medium text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-700/50"
            >
              {savedFlash ? 'Görünüm Kaydedildi' : 'Görünümü Kaydet'}
            </button>
            <button
              type="button"
              onClick={resetAll}
              className="mt-0.5 w-full rounded-lg px-2 py-1.5 text-left text-xs text-brand-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-900/20"
            >
              Varsayılana Dön (Görünüm + Genişlik)
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
  headerDragProps: (colId: string) => {
    draggable: true;
    onDragStart: (e: DragEvent) => void;
    onDragOver: (e: DragEvent) => void;
    onDrop: (e: DragEvent) => void;
    onDragEnd: () => void;
    className?: string;
  };
}

const TableColumnsContext = createContext<PanelTableColumnsValue | null>(null);

export function usePanelTableColumns(storageKey: string, columns: TableColumnDef[]) {
  const prefs = useTableColumnPrefs(storageKey, columns);
  const widths = useTableColumnWidths(storageKey, columns);
  const [headerDragId, setHeaderDragId] = useState<string | null>(null);
  const headerDragIdRef = useRef<string | null>(null);
  const resetAll = useCallback(() => {
    prefs.reset();
    widths.resetWidths();
  }, [prefs, widths]);

  const headerDragProps = useCallback(
    (colId: string) => ({
      draggable: true as const,
      onDragStart: (e: DragEvent) => {
        e.dataTransfer.setData('text/plain', colId);
        e.dataTransfer.effectAllowed = 'move';
        headerDragIdRef.current = colId;
        setHeaderDragId(colId);
      },
      onDragOver: (e: DragEvent) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
      },
      onDrop: (e: DragEvent) => {
        e.preventDefault();
        const fromId = headerDragIdRef.current || e.dataTransfer.getData('text/plain');
        if (fromId && fromId !== colId) {
          prefs.reorderColumn(fromId, colId);
        }
        headerDragIdRef.current = null;
        setHeaderDragId(null);
      },
      onDragEnd: () => {
        headerDragIdRef.current = null;
        setHeaderDragId(null);
      },
      className: headerDragId === colId ? 'opacity-50' : undefined,
    }),
    [headerDragId, prefs],
  );

  return useMemo(
    () => ({ storageKey, columns, prefs, widths, resetAll, headerDragProps }),
    [storageKey, columns, prefs, widths, resetAll, headerDragProps],
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
      columnOrder={tableColumns.prefs.columnOrder}
      storageKey={tableColumns.storageKey}
      widths={tableColumns.widths.widths}
      onToggle={tableColumns.prefs.toggle}
      onMoveColumn={tableColumns.prefs.moveColumn}
      onReorderColumn={tableColumns.prefs.reorderColumn}
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
  fitSamples?: string[];
  draggable?: boolean;
}

export function PanelTableTh({ colId, className = '', children, resizable = true, fitSamples, draggable = true }: PanelTableThProps) {
  const ctx = useTableColumnsCtx();
  if (ctx && !ctx.prefs.isVisible(colId)) return null;
  if (!ctx) {
    return <th className={`text-center ${className}`}>{children}</th>;
  }
  const meta = colMeta(ctx, colId);
  const canDrag = draggable && meta?.pin !== 'end';
  const dragProps = canDrag ? ctx.headerDragProps(colId) : undefined;
  return (
    <ResizableTh
      colId={colId}
      width={ctx.widths.getWidth(colId)}
      minWidth={meta?.minWidth ?? 72}
      defaultWidth={meta?.defaultWidth ?? 140}
      fitLabel={meta?.label}
      fitSamples={fitSamples}
      onResize={ctx.widths.setWidth}
      className={`${className} ${dragProps?.className ?? ''}`.trim()}
      resizable={resizable && meta?.resizable !== false}
      dragProps={dragProps}
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
  /** Kurumsal tablo hizası — operasyon listelerinde varsayılan center */
  align?: 'left' | 'center' | 'right';
}

export function PanelTableTd({ colId, className = '', children, title, align = 'left' }: PanelTableTdProps) {
  const ctx = useTableColumnsCtx();
  if (ctx && !ctx.prefs.isVisible(colId)) return null;
  const width = ctx?.widths.getWidth(colId);
  const alignClass =
    align === 'center' ? 'text-center' : align === 'right' ? 'text-right' : 'text-left';
  const innerClass =
    align === 'center'
      ? 'flex min-w-0 justify-center'
      : align === 'right'
        ? 'flex min-w-0 justify-end'
        : 'min-w-0';
  return (
    <td
      className={`max-w-0 overflow-hidden align-middle ${alignClass} ${className}`}
      style={width ? tableCellStyle(width) : undefined}
      title={title}
    >
      <div className={innerClass}>{children}</div>
    </td>
  );
}

interface PanelTableColGroupProps {
  /** Checkbox vb. — soldaki sabit sütun genişlikleri (px) */
  leadingWidths?: number[];
  /** İşlemler vb. — sağdaki sabit sütun genişlikleri (px) */
  trailingWidths?: number[];
}

/** thead/tbody hizası için sütun genişliklerini colgroup ile kilitle */
export function PanelTableColGroup({ leadingWidths = [], trailingWidths = [] }: PanelTableColGroupProps) {
  const ctx = useTableColumnsCtx();
  if (!ctx) return null;
  const visible = ctx.prefs.orderedVisibleColumns;
  return (
    <colgroup>
      {leadingWidths.map((width, index) => (
        <col key={`leading-${index}`} style={{ width }} />
      ))}
      {visible.map((col) => (
        <col
          key={col.id}
          style={col.flex ? undefined : { width: ctx.widths.getWidth(col.id) }}
        />
      ))}
      {trailingWidths.map((width, index) => (
        <col key={`trailing-${index}`} style={{ width }} />
      ))}
    </colgroup>
  );
}

interface SortablePanelTableThProps extends PanelTableThProps {
  sortKey: string;
  activeSortKey: string | null;
  sortDir: 'asc' | 'desc';
  onSort: (key: string) => void;
}

export function SortablePanelTableTh({
  colId,
  className = '',
  children,
  sortKey,
  activeSortKey,
  sortDir,
  onSort,
  resizable = true,
}: SortablePanelTableThProps) {
  const active = activeSortKey === sortKey;
  const sortTitle = active
    ? sortDir === 'asc'
      ? 'Sıralı: Artan — Tıklayınca Azalan'
      : 'Sıralı: Azalan — Tıklayınca Varsayılan'
    : 'Sıralamak İçin Tıklayın (Artan)';
  const label = (
    <span
      role="button"
      tabIndex={0}
      title={sortTitle}
      aria-sort={active ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
      className={`inline-flex w-full cursor-pointer items-center justify-center gap-1 transition-colors hover:text-slate-800 dark:hover:text-slate-100 ${
        active ? 'text-blue-700 dark:text-blue-300' : 'text-inherit'
      }`}
      onClick={(e) => {
        e.stopPropagation();
        onSort(sortKey);
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          e.stopPropagation();
          onSort(sortKey);
        }
      }}
    >
      {children}
      <span
        className={`text-[10px] font-semibold transition-opacity ${
          active ? 'opacity-100 text-brand-600 dark:text-blue-400' : 'opacity-40 group-hover:opacity-70'
        }`}
        aria-hidden
      >
        {active ? (sortDir === 'desc' ? '↓' : '↑') : '⇅'}
      </span>
    </span>
  );
  return (
    <PanelTableTh colId={colId} className={`${className} group`.trim()} resizable={resizable}>
      {label}
    </PanelTableTh>
  );
}

export function panelTableLayoutStyle(
  tableColumns: PanelTableColumnsValue,
  options?: { leadingWidths?: number[]; trailingWidths?: number[] },
) {
  const leading = (options?.leadingWidths ?? []).reduce((sum, w) => sum + w, 0);
  const trailing = (options?.trailingWidths ?? []).reduce((sum, w) => sum + w, 0);
  const total =
    tableColumns.prefs.orderedVisibleColumns.reduce(
      (sum, col) => sum + tableColumns.widths.getWidth(col.id),
      0,
    ) + leading + trailing;
  const totalPx = Math.max(total, 720);
  return { tableLayout: 'fixed' as const, width: '100%', minWidth: `${totalPx}px` };
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
  const visible = tableColumns.prefs.orderedVisibleColumns;
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
          style={{ width: actionColWidth, minWidth: actionColWidth }}
          className="px-5 py-3"
        />
      </tr>
    </tfoot>
  );
}

/** Tablo taşmasını kart içinde yatay kaydırmaya hapseder; mobilde sayfa genişliğini bozmaz */
export function PanelTableFrame({
  children,
  toolbar,
  className = '',
}: {
  children: ReactNode;
  toolbar?: ReactNode;
  className?: string;
}) {
  return (
    <div className={`min-w-0 max-w-full overflow-hidden rounded-xl border border-slate-200 bg-white ${className}`}>
      {toolbar ? (
        <div className="flex min-w-0 justify-end border-b border-slate-100 px-3 py-2 sm:px-4">{toolbar}</div>
      ) : null}
      <div className="max-w-full overflow-x-auto">{children}</div>
    </div>
  );
}
