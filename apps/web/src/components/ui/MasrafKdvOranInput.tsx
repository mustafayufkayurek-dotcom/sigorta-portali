'use client';

/**
 * KDV oranı — satır açmadan klavyeden 1 / 20 yazılınca listelenir ve seçilir.
 */
import { useEffect, useMemo, useRef, useState } from 'react';

type MasrafKdvOranInputProps = {
  value: string;
  rates: number[];
  onChange: (rate: string) => void;
  className?: string;
  id?: string;
  testId?: string;
  disabled?: boolean;
};

function rateLabel(n: number): string {
  return `%${n}`;
}

export function MasrafKdvOranInput({
  value,
  rates,
  onChange,
  className = '',
  id,
  testId = 'masraf-kdv-oran',
  disabled,
}: MasrafKdvOranInputProps) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(value);
  const [focused, setFocused] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!focused) setDraft(value);
  }, [value, focused]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (ev: MouseEvent) => {
      if (!wrapRef.current?.contains(ev.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  const filtered = useMemo(() => {
    const q = draft.replace(/[^\d.,]/g, '').replace(',', '.');
    if (!q) return rates;
    return rates.filter((r) => String(r).startsWith(q) || rateLabel(r).includes(q));
  }, [draft, rates]);

  const commitDraft = (raw: string) => {
    const n = Number(String(raw).replace('%', '').replace(',', '.').trim());
    if (!Number.isFinite(n)) {
      setDraft(value);
      return;
    }
    const match = rates.find((r) => r === n)
      ?? rates.find((r) => String(r).startsWith(String(n)));
    if (match != null) {
      onChange(String(match));
      setDraft(String(match));
      return;
    }
    setDraft(value);
  };

  return (
    <div className="relative min-w-0 flex-1" ref={wrapRef} data-testid={testId}>
      <input
        id={id}
        disabled={disabled}
        className={className}
        inputMode="decimal"
        autoComplete="off"
        placeholder="%20"
        value={focused || open ? (draft.startsWith('%') ? draft : draft ? `%${draft}` : '') : rateLabel(Number(value) || 0)}
        data-testid={`${testId}-input`}
        onFocus={() => {
          setFocused(true);
          setDraft(value);
          setOpen(true);
        }}
        onBlur={() => {
          setFocused(false);
          commitDraft(draft);
          window.setTimeout(() => setOpen(false), 120);
        }}
        onChange={(e) => {
          const raw = e.target.value.replace(/%/g, '');
          setDraft(raw);
          setOpen(true);
          const exact = rates.find((r) => String(r) === raw.replace(',', '.'));
          if (exact != null) onChange(String(exact));
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            commitDraft(draft);
            setOpen(false);
            (e.target as HTMLInputElement).blur();
          }
          if (e.key === 'Escape') {
            setDraft(value);
            setOpen(false);
          }
          if (e.key === 'ArrowDown') {
            e.preventDefault();
            setOpen(true);
          }
        }}
      />
      {open && filtered.length > 0 ? (
        <ul
          className="absolute z-30 mt-1 max-h-40 w-full overflow-auto rounded-lg border border-slate-200 bg-white py-1 shadow-lg dark:border-slate-600 dark:bg-slate-900"
          data-testid={`${testId}-liste`}
        >
          {filtered.map((rate) => (
            <li key={rate}>
              <button
                type="button"
                className={`flex w-full px-3 py-1.5 text-left text-sm tabular-nums hover:bg-brand-50 dark:hover:bg-slate-800 ${
                  String(rate) === value ? 'bg-brand-50 font-semibold text-brand-800 dark:bg-brand-950/40 dark:text-brand-200' : 'text-slate-700 dark:text-slate-200'
                }`}
                onMouseDown={(ev) => {
                  ev.preventDefault();
                  onChange(String(rate));
                  setDraft(String(rate));
                  setOpen(false);
                }}
              >
                {rateLabel(rate)}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
