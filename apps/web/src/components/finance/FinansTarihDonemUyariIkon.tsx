'use client';

import { useEffect, useId, useRef, useState } from 'react';

/** Tarih etiketinde dönem uyarısı — kutuyu şişirmez; ikon yanıp söner, metin içinde. */
export function FinansTarihDonemUyariIkon({
  message,
  closed = false,
  testId = 'finans-tarih-donem-uyari-ikon',
}: {
  message: string;
  /** Kapalı dönem: kırmızı nabız; açık farklı ay: turuncu. */
  closed?: boolean;
  testId?: string;
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLSpanElement>(null);
  const panelId = useId();
  const leaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  useEffect(
    () => () => {
      if (leaveTimer.current) clearTimeout(leaveTimer.current);
    },
    [],
  );

  if (!message.trim()) return null;

  const clearLeave = () => {
    if (leaveTimer.current) {
      clearTimeout(leaveTimer.current);
      leaveTimer.current = null;
    }
  };

  return (
    <span
      ref={wrapRef}
      className="relative inline-flex shrink-0 align-middle"
      onMouseEnter={() => {
        clearLeave();
        setOpen(true);
      }}
      onMouseLeave={() => {
        clearLeave();
        leaveTimer.current = setTimeout(() => setOpen(false), 140);
      }}
    >
      <button
        type="button"
        data-testid={testId}
        data-closed={closed ? '1' : '0'}
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={closed ? 'Kapalı dönem uyarısı' : 'Dönem uyarısı'}
        title={message}
        onClick={() => setOpen((v) => !v)}
        className={[
          'inline-flex h-5 w-5 items-center justify-center rounded-full border text-[11px] font-bold leading-none',
          closed
            ? 'finans-tarih-donem-uyari-ikon--closed border-rose-500 bg-rose-50 text-rose-700'
            : 'finans-tarih-donem-uyari-ikon border-amber-500 bg-amber-50 text-amber-800',
        ].join(' ')}
      >
        !
      </button>
      {open ? (
        <span
          id={panelId}
          role="tooltip"
          data-testid={`${testId}-panel`}
          className={[
            'absolute left-0 top-6 z-40 w-72 rounded-lg border px-2.5 py-2 text-[11px] font-normal leading-relaxed shadow-md',
            closed
              ? 'border-rose-200 bg-white text-rose-900'
              : 'border-amber-200 bg-white text-amber-950',
          ].join(' ')}
        >
          {message}
        </span>
      ) : null}
    </span>
  );
}
