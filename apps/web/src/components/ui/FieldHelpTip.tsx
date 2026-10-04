'use client';

import { useEffect, useId, useRef, useState, type ReactNode } from 'react';

/** Alan açıklaması — başlık i yasağı durur; yalnız kutu yanında tıklanınca okunur. */
export function FieldHelpTip({
  text,
  children,
  testId,
}: {
  text?: string;
  children?: ReactNode;
  testId?: string;
}) {
  const content = children ?? text;
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLSpanElement>(null);
  const panelId = useId();

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  if (content == null || content === '') return null;

  return (
    <span ref={wrapRef} className="relative inline-flex shrink-0 align-middle">
      <button
        type="button"
        data-testid={testId ?? 'field-help-tip'}
        aria-expanded={open}
        aria-controls={panelId}
        aria-label="Açıklama"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-slate-300 bg-white text-[10px] font-semibold leading-none text-slate-500 hover:border-slate-400 hover:text-slate-700"
      >
        i
      </button>
      {open ? (
        <span
          id={panelId}
          role="tooltip"
          className="absolute left-0 top-5 z-30 w-64 rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-[11px] font-normal leading-relaxed text-slate-600 shadow-md"
        >
          {content}
        </span>
      ) : null}
    </span>
  );
}

export function FieldLabel({
  children,
  help,
  htmlFor,
  className = 'mb-1.5 flex items-center gap-1.5 text-xs font-medium text-slate-500',
  testId,
}: {
  children: ReactNode;
  help?: ReactNode;
  htmlFor?: string;
  className?: string;
  testId?: string;
}) {
  return (
    <label htmlFor={htmlFor} className={className}>
      <span>{children}</span>
      {help != null && help !== '' ? (
        typeof help === 'string' ? (
          <FieldHelpTip text={help} testId={testId} />
        ) : (
          <FieldHelpTip testId={testId}>{help}</FieldHelpTip>
        )
      ) : null}
    </label>
  );
}
