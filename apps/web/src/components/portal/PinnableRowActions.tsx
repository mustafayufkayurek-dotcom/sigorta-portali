'use client';

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { MoreVertical } from 'lucide-react';
import { ActionIconButton } from '@/components/ui/ActionIconButton';

export type PinnableRowActionItem = {
  id: string;
  label: string;
  icon: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  hidden?: boolean;
  danger?: boolean;
  testId?: string;
};

export function PinnableRowActions({
  rowId,
  menuEvent,
  testId,
  menuTestId,
  moreTestId,
  pinnedIds,
  items,
}: {
  rowId: string;
  menuEvent: string;
  testId: string;
  menuTestId: string;
  moreTestId: string;
  pinnedIds: string[];
  items: PinnableRowActionItem[];
}) {
  const [open, setOpen] = useState(false);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const moreBtnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const visible = items.filter((item) => !item.hidden);
  const pinned = visible.filter((item) => pinnedIds.includes(item.id));
  const overflow = visible.filter((item) => !pinnedIds.includes(item.id));

  const updateMenuPos = () => {
    const btn = moreBtnRef.current;
    if (!btn) return;
    const rect = btn.getBoundingClientRect();
    const menuWidth = 220;
    const left = Math.min(Math.max(8, rect.right - menuWidth), window.innerWidth - menuWidth - 8);
    setMenuPos({ top: rect.bottom + 4, left });
  };

  useLayoutEffect(() => {
    if (!open) {
      setMenuPos(null);
      return;
    }
    updateMenuPos();
    const onScrollOrResize = () => updateMenuPos();
    window.addEventListener('scroll', onScrollOrResize, true);
    window.addEventListener('resize', onScrollOrResize);
    return () => {
      window.removeEventListener('scroll', onScrollOrResize, true);
      window.removeEventListener('resize', onScrollOrResize);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      const target = e.target as Node;
      if (rootRef.current?.contains(target)) return;
      if (menuRef.current?.contains(target)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    const timer = window.setTimeout(() => {
      document.addEventListener('mousedown', onDoc);
    }, 0);
    document.addEventListener('keydown', onKey);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  useEffect(() => {
    const closeOthers = (e: Event) => {
      const detail = (e as CustomEvent<string>).detail;
      if (detail !== rowId) setOpen(false);
    };
    window.addEventListener(menuEvent, closeOthers as EventListener);
    return () => window.removeEventListener(menuEvent, closeOthers as EventListener);
  }, [menuEvent, rowId]);

  const toggleMenu = () => {
    setOpen((v) => {
      const next = !v;
      if (next) window.dispatchEvent(new CustomEvent(menuEvent, { detail: rowId }));
      return next;
    });
  };

  const run = (fn: () => void) => {
    setOpen(false);
    window.setTimeout(fn, 0);
  };

  const menu =
    open && menuPos && overflow.length > 0 && typeof document !== 'undefined'
      ? createPortal(
          <div
            ref={menuRef}
            className="fixed z-[220] min-w-[220px] rounded-lg border border-slate-200 bg-white py-1 text-xs shadow-lg"
            style={{ top: menuPos.top, left: menuPos.left }}
            role="menu"
            data-testid={menuTestId}
            onMouseDown={(e) => e.stopPropagation()}
          >
            {overflow.map((item) => (
              <button
                key={item.id}
                type="button"
                role="menuitem"
                disabled={item.disabled}
                className={`flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 ${
                  item.danger ? 'text-status-danger hover:bg-red-50' : 'text-slate-700'
                }`}
                onMouseDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  if (item.disabled) return;
                  run(item.onClick);
                }}
              >
                {item.icon}
                {item.label}
              </button>
            ))}
          </div>,
          document.body,
        )
      : null;

  return (
    <div
      ref={rootRef}
      className="relative flex shrink-0 flex-nowrap items-center justify-center gap-1"
      onClick={(e) => e.stopPropagation()}
      data-testid={testId}
    >
      {pinned.map((item) => (
        <ActionIconButton
          key={item.id}
          label={item.label}
          onClick={item.onClick}
          disabled={item.disabled}
          testId={item.testId}
        >
          {item.icon}
        </ActionIconButton>
      ))}
      {overflow.length > 0 ? (
        <ActionIconButton
          label="Diğer"
          onClick={toggleMenu}
          testId={moreTestId}
          buttonRef={moreBtnRef}
          showTooltip={false}
        >
          <MoreVertical className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden />
        </ActionIconButton>
      ) : null}
      {menu}
    </div>
  );
}
