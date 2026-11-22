'use client';

/**
 * Tutar satırı hesap makinesi — sonucu TL girişine yazar.
 */
import { useEffect, useRef, useState } from 'react';
import { Calculator } from 'lucide-react';
import { numberToTrAmountInput } from '@/utils/tr-amount-input';

type TrAmountCalculatorProps = {
  onApply: (amountInput: string) => void;
  disabled?: boolean;
  testId?: string;
};

function evalExpression(raw: string): number | null {
  const cleaned = String(raw ?? '')
    .replace(/\s+/g, '')
    .replace(/,/g, '.')
    .replace(/×/g, '*')
    .replace(/÷/g, '/');
  if (!cleaned || !/^[\d.+\-*/()]+$/.test(cleaned)) return null;
  if (/[+\-*/.]{2,}/.test(cleaned.replace(/\.\d+/g, ''))) return null;
  try {
    // eslint-disable-next-line no-new-func
    const result = Function(`"use strict"; return (${cleaned});`)() as unknown;
    const n = typeof result === 'number' ? result : Number(result);
    if (!Number.isFinite(n) || n < 0) return null;
    return Math.round((n + Number.EPSILON) * 100) / 100;
  } catch {
    return null;
  }
}

export function TrAmountCalculator({
  onApply,
  disabled,
  testId = 'tutar-hesap-makinesi',
}: TrAmountCalculatorProps) {
  const [open, setOpen] = useState(false);
  const [expr, setExpr] = useState('');
  const [error, setError] = useState('');
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (ev: MouseEvent) => {
      if (!panelRef.current?.contains(ev.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  const append = (token: string) => {
    setError('');
    setExpr((v) => `${v}${token}`);
  };

  const apply = () => {
    const n = evalExpression(expr);
    if (n == null || n <= 0) {
      setError('Geçerli bir hesap yazın.');
      return;
    }
    onApply(numberToTrAmountInput(n));
    setExpr('');
    setError('');
    setOpen(false);
  };

  const keys = [
    '7', '8', '9', '÷',
    '4', '5', '6', '×',
    '1', '2', '3', '-',
    '0', ',', '.', '+',
  ] as const;

  return (
    <div className="relative" ref={panelRef} data-testid={testId}>
      <button
        type="button"
        disabled={disabled}
        aria-label="Hesap makinesi"
        title="Hesap makinesi"
        className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-slate-300 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
        data-testid={`${testId}-ac`}
        onClick={() => {
          setOpen((v) => !v);
          setError('');
        }}
      >
        <Calculator className="h-4 w-4" strokeWidth={1.75} aria-hidden />
      </button>
      {open ? (
        <div
          className="absolute right-0 z-30 mt-1 w-56 rounded-xl border border-slate-200 bg-white p-2.5 shadow-lg dark:border-slate-600 dark:bg-slate-900"
          data-testid={`${testId}-panel`}
        >
          <input
            className="mb-2 w-full rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2 text-sm tabular-nums text-slate-800 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
            value={expr}
            placeholder="Örn. 120+45,5"
            inputMode="decimal"
            autoFocus
            onChange={(e) => {
              setExpr(e.target.value);
              setError('');
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                apply();
              }
            }}
            data-testid={`${testId}-ifade`}
          />
          <div className="grid grid-cols-4 gap-1.5">
            {keys.map((k) => (
              <button
                key={k}
                type="button"
                className="rounded-lg border border-slate-200 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
                onClick={() => append(k === '÷' ? '/' : k === '×' ? '*' : k)}
              >
                {k}
              </button>
            ))}
          </div>
          <div className="mt-2 flex gap-1.5">
            <button
              type="button"
              className="flex-1 rounded-lg border border-slate-200 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300"
              onClick={() => { setExpr(''); setError(''); }}
            >
              Temizle
            </button>
            <button
              type="button"
              className="flex-1 rounded-lg bg-brand-600 py-1.5 text-xs font-semibold text-white hover:bg-brand-700"
              data-testid={`${testId}-uygula`}
              onClick={apply}
            >
              Uygula
            </button>
          </div>
          {error ? (
            <p className="mt-1.5 text-[11px] text-status-danger">{error}</p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
