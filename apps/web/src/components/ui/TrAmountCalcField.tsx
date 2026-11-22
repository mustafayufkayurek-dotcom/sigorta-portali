'use client';

/**
 * Tutar girişi + işlem özeti.
 * + − × ÷ tuşuna basınca tam hesap makinesi değil; yalnız işlem özeti açılır.
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
      <div className="flex items-start gap-2">
        <div className="relative min-w-0 flex-1">
          <input
            ref={inputRef}
            type="text"
            inputMode={exprMode ? 'text' : 'decimal'}
            autoComplete="off"
            disabled={disabled}
            placeholder={placeholder}
            className={`${className} pr-10 [&:invalid]:shadow-none [&:invalid]:outline-none`}
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
          <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-slate-400">
            TL
          </span>
        </div>
        <button
          type="button"
          disabled={disabled}
          aria-label="İşlem özeti"
          title="İşlem özeti"
          className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-slate-300 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
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
          <Calculator className="h-4 w-4" strokeWidth={1.75} aria-hidden />
        </button>
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
