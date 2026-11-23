'use client';

/**
 * Tutar girişi + işlem özeti.
 * + − × ÷ tuşuna basınca tam hesap makinesi değil; yalnız işlem özeti açılır.
 * Hesap ikonu kutunun içinde, küçük; tutar alanı geniş kalır.
 */
import { useEffect, useRef, useState } from 'react';
import { Calculator } from 'lucide-react';
import {
  evaluateAmountExpression,
  formatTrAmountInput,
  numberToTrAmountInput,
  parseTrAmountInput,
} from '@/utils/tr-amount-input';

const OP_KEYS = new Set(['+', '-', '*', '/', '×', '÷']);

function mapOpKey(key: string): string {
  if (key === '×') return '*';
  if (key === '÷') return '/';
  return key;
}

function opLabel(op: string): string {
  if (op === '*') return '×';
  if (op === '/') return '÷';
  return op;
}

function displayExpr(expr: string): string {
  return expr.replace(/\*/g, '×').replace(/\//g, '÷');
}

function livePreview(expr: string): { text: string; result: number | null } {
  const shown = displayExpr(expr);
  const complete = evaluateAmountExpression(expr);
  if (complete != null && complete > 0) {
    return { text: `${shown} = ${numberToTrAmountInput(complete)}`, result: complete };
  }
  return { text: shown || '—', result: null };
}

type TrAmountCalcFieldProps = {
  value: string;
  onChange: (value: string) => void;
  className?: string;
  placeholder?: string;
  disabled?: boolean;
  testId?: string;
};

export function TrAmountCalcField({
  value,
  onChange,
  className = '',
  placeholder = '0',
  disabled,
  testId = 'tutar-hesap-alan',
}: TrAmountCalcFieldProps) {
  const [exprMode, setExprMode] = useState(false);
  const [expr, setExpr] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!exprMode) return;
    const el = inputRef.current;
    if (!el) return;
    el.focus();
    const len = el.value.length;
    el.setSelectionRange(len, len);
  }, [exprMode]);

  const startExpr = (op?: string) => {
    const baseNum = parseTrAmountInput(value);
    const base = baseNum != null && baseNum > 0 ? numberToTrAmountInput(baseNum) : (value || '0');
    const next = op ? `${base}${mapOpKey(op)}` : `${base}+`;
    setExpr(next);
    setExprMode(true);
  };

  const applyExpr = () => {
    const result = evaluateAmountExpression(expr);
    if (result == null || result <= 0) return false;
    onChange(numberToTrAmountInput(result));
    setExprMode(false);
    setExpr('');
    return true;
  };

  const cancelExpr = () => {
    setExprMode(false);
    setExpr('');
  };

  const preview = exprMode ? livePreview(expr) : null;
  const display = exprMode
    ? displayExpr(expr)
    : value.includes('.') || value.includes(',')
      ? value
      : value && /^\d+$/.test(value)
        ? numberToTrAmountInput(Number(value))
        : value;

  return (
    <div className="relative" data-testid={testId}>
      <div className="relative min-w-0">
        <input
          ref={inputRef}
          type="text"
          inputMode={exprMode ? 'text' : 'decimal'}
          autoComplete="off"
          disabled={disabled}
          placeholder={placeholder}
          className={`${className} pr-[4.25rem] [&:invalid]:shadow-none [&:invalid]:outline-none`}
          value={display}
          data-testid={`${testId}-input`}
          onChange={(e) => {
            if (exprMode) {
              const raw = e.target.value
                .replace(/×/g, '*')
                .replace(/÷/g, '/')
                .replace(/[^\d+\-*/.,\s]/g, '');
              setExpr(raw);
              return;
            }
            onChange(formatTrAmountInput(e.target.value));
          }}
          onBlur={() => {
            if (!exprMode) return;
            if (!applyExpr()) cancelExpr();
          }}
          onKeyDown={(e) => {
            if (disabled) return;
            if (OP_KEYS.has(e.key)) {
              e.preventDefault();
              if (exprMode) {
                setExpr((v) => {
                  const trimmed = v.replace(/\s+$/g, '');
                  if (/[+\-*/]$/.test(trimmed)) {
                    return `${trimmed.slice(0, -1)}${mapOpKey(e.key)}`;
                  }
                  return `${trimmed}${mapOpKey(e.key)}`;
                });
              } else {
                startExpr(e.key);
              }
              return;
            }
            if (exprMode && e.key === 'Enter') {
              e.preventDefault();
              applyExpr();
              return;
            }
            if (exprMode && e.key === 'Escape') {
              e.preventDefault();
              cancelExpr();
            }
          }}
        />
        <div className="pointer-events-none absolute inset-y-0 right-2 flex items-center gap-0.5">
          <button
            type="button"
            tabIndex={-1}
            disabled={disabled}
            aria-label="İşlem özeti"
            title="İşlem özeti (+ − × ÷)"
            className="pointer-events-auto inline-flex h-7 w-7 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-slate-100 hover:text-brand-700 disabled:opacity-50 dark:hover:bg-slate-700 dark:hover:text-brand-300"
            data-testid={`${testId}-ac`}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              if (exprMode) {
                applyExpr();
              } else {
                startExpr('+');
              }
            }}
          >
            <Calculator className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden />
          </button>
          <span className="pr-1 text-sm text-slate-400">TL</span>
        </div>
      </div>
      {exprMode && preview ? (
        <div
          className="mt-1.5 rounded-lg border border-brand-200 bg-brand-50 px-2.5 py-1.5 text-xs text-brand-900 dark:border-brand-800 dark:bg-brand-950/40 dark:text-brand-100"
          data-testid={`${testId}-ozet`}
        >
          <span className="font-medium">İşlem: </span>
          <span className="tabular-nums">{preview.text}</span>
          {preview.result != null ? (
            <span className="ml-2 text-[11px] text-brand-700 dark:text-brand-300">Enter ile yaz</span>
          ) : (
            <span className="ml-2 text-[11px] text-slate-500">
              {opLabel('+')} {opLabel('-')} {opLabel('*')} {opLabel('/')} ile devam
            </span>
          )}
        </div>
      ) : null}
    </div>
  );
}
