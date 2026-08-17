'use client';

import {
  useCallback,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type MutableRefObject,
  type ReactNode,
  type Ref,
  type RefObject,
} from 'react';
import { createPortal } from 'react-dom';

export const actionIconBtnClass =
  'inline-flex h-7 w-7 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-500 transition-colors hover:border-slate-300 hover:bg-slate-50 hover:text-slate-800 disabled:cursor-not-allowed disabled:opacity-40';

type ActionIconButtonProps = {
  label: string;
  children: ReactNode;
  testId?: string;
  buttonRef?: RefObject<HTMLButtonElement>;
  className?: string;
  disabled?: boolean;
  /** false ise yalnızca aria-label kalır; görünür tooltip gösterilmez */
  showTooltip?: boolean;
} & Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children' | 'title' | 'aria-label' | 'className' | 'disabled'>;

function assignRef<T>(ref: Ref<T> | undefined, value: T | null) {
  if (!ref) return;
  if (typeof ref === 'function') {
    ref(value);
    return;
  }
  (ref as MutableRefObject<T | null>).current = value;
}

/**
 * Tablo overflow içinde kesilmeyen hover önizleme (portal tooltip).
 */
export function ActionIconButton({
  label,
  onClick,
  children,
  testId,
  buttonRef,
  className,
  disabled,
  showTooltip = true,
  ...rest
}: ActionIconButtonProps) {
  const localRef = useRef<HTMLButtonElement>(null);
  const [tip, setTip] = useState<{ top: number; left: number } | null>(null);

  const setRefs = useCallback(
    (node: HTMLButtonElement | null) => {
      (localRef as MutableRefObject<HTMLButtonElement | null>).current = node;
      assignRef(buttonRef, node);
    },
    [buttonRef],
  );

  const showTip = () => {
    if (!showTooltip) return;
    const el = localRef.current;
    if (!el || disabled) return;
    const r = el.getBoundingClientRect();
    setTip({ top: r.top - 6, left: r.left + r.width / 2 });
  };

  const hideTip = () => setTip(null);

  const tipNode =
    tip && typeof document !== 'undefined'
      ? createPortal(
          <span
            role="tooltip"
            className="pointer-events-none fixed z-[230] -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-md bg-slate-900 px-2 py-1 text-[11px] font-medium text-white shadow-md"
            style={{ top: tip.top, left: tip.left }}
          >
            {label}
          </span>,
          document.body,
        )
      : null;

  return (
    <>
      <button
        ref={setRefs}
        type="button"
        aria-label={label}
        disabled={disabled}
        className={className ?? actionIconBtnClass}
        onClick={(e) => {
          hideTip();
          onClick?.(e);
        }}
        onMouseDown={hideTip}
        onMouseEnter={showTip}
        onMouseLeave={hideTip}
        onFocus={showTip}
        onBlur={hideTip}
        data-testid={testId}
        {...rest}
      >
        {children}
      </button>
      {tipNode}
    </>
  );
}
