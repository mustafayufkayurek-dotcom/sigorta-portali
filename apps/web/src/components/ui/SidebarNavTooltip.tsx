'use client';

import { useCallback, useId, useRef, useState, type ReactNode } from 'react';

interface SidebarNavTooltipProps {
  label: string;
  collapsed: boolean;
  children: ReactNode;
}

export function SidebarNavTooltip({ label, collapsed, children }: SidebarNavTooltipProps) {
  const tooltipId = useId();
  const triggerRef = useRef<HTMLSpanElement>(null);
  const [visible, setVisible] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });

  const updatePosition = useCallback(() => {
    const target = triggerRef.current;
    if (!target) return;
    const rect = target.getBoundingClientRect();
    setPosition({
      top: rect.top + rect.height / 2,
      left: rect.right + 10,
    });
  }, []);

  const showTooltip = useCallback(() => {
    updatePosition();
    setVisible(true);
  }, [updatePosition]);

  const hideTooltip = useCallback(() => {
    setVisible(false);
  }, []);

  if (!collapsed) return <>{children}</>;

  return (
    <>
      <span
        ref={triggerRef}
        className="block w-full"
        onMouseEnter={showTooltip}
        onMouseLeave={hideTooltip}
        onFocusCapture={showTooltip}
        onBlurCapture={hideTooltip}
      >
        {children}
      </span>
      {visible ? (
        <span
          id={tooltipId}
          role="tooltip"
          className="pointer-events-none fixed z-[100] -translate-y-1/2 whitespace-nowrap rounded-lg bg-slate-900 px-2.5 py-1.5 text-xs font-semibold text-white shadow-lg dark:bg-slate-100 dark:text-slate-900"
          style={{ top: position.top, left: position.left }}
        >
          {label}
        </span>
      ) : null}
    </>
  );
}
