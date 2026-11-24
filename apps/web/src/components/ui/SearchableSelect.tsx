'use client';

import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { normalizeSearchTR } from '@/utils/text-helpers';

export interface SearchableSelectOption {
  value: string;
  label: string;
  hint?: string;
}

interface SearchableSelectProps {
  options: SearchableSelectOption[];
  value: string;
  onChange: (value: string) => void;
  onQueryChange?: (query: string) => void;
  placeholder?: string;
  emptyText?: string;
  /** Seçenekler yüklenirken liste yerine gösterilir */
  loading?: boolean;
  loadingText?: string;
  /**
   * value options içinde yokken (düzenleme / async yükleme) gösterilecek etiket.
   * Kök neden: seçim kaybolmuş gibi görünmesi.
   */
  fallbackLabel?: string;
  disabled?: boolean;
  className?: string;
  inputClassName?: string;
  /** Tarayıcı adres/otomatik doldurma menüsünü kapatır */
  disableBrowserAutocomplete?: boolean;
  /** Listenin altında durur. Sayfa değiştirmez. */
  createAction?: { label: string; onSelect: () => void };
  /** Odaklanınca mevcut metnin tamamı seçilir (üzerine yazmak kolay). */
  selectAllOnFocus?: boolean;
}

const normalizeSearchDigits = (s: string) => s.replace(/\D/g, '');

export function SearchableSelect({
  options,
  value,
  onChange,
  onQueryChange,
  placeholder = 'Ara veya seç...',
  emptyText = 'Sonuç bulunamadı',
  loading = false,
  loadingText = 'Yükleniyor…',
  fallbackLabel,
  disabled = false,
  className = '',
  inputClassName = '',
  disableBrowserAutocomplete = false,
  createAction,
  selectAllOnFocus = true,
}: SearchableSelectProps) {
  const listId = useId();
  const inputName = useId().replace(/:/g, '');
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [highlight, setHighlight] = useState(0);

  const selected = options.find((o) => o.value === value);
  const displayLabel = selected?.label ?? (value ? (fallbackLabel ?? '') : '');

  useEffect(() => {
    if (!open) setQuery(displayLabel);
  }, [open, displayLabel]);

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  const filtered = useMemo(() => {
    const q = normalizeSearchTR(query.trim());
    if (!q) return options;
    const qDigits = normalizeSearchDigits(q);
    return options.filter((o) => {
      const label = normalizeSearchTR(o.label);
      if (label.includes(q)) return true;
      if (o.hint && normalizeSearchTR(o.hint).includes(q)) return true;
      if (qDigits.length >= 3 && normalizeSearchDigits(o.label).includes(qDigits)) return true;
      return false;
    });
  }, [options, query]);

  useEffect(() => {
    if (!open) return;
    const idx = filtered.findIndex((o) => o.value === value);
    setHighlight(idx >= 0 ? idx : 0);
  }, [open, filtered, value]);

  const pick = (next: string) => {
    onChange(next);
    const opt = options.find((o) => o.value === next);
    setQuery(opt?.label ?? '');
    setOpen(false);
  };

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <input
        ref={inputRef}
        type="text"
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-activedescendant={open && filtered[highlight] ? `${listId}-opt-${filtered[highlight].value}` : undefined}
        disabled={disabled}
        placeholder={placeholder}
        value={open ? query : displayLabel || query}
        name={disableBrowserAutocomplete ? `meridyen-select-${inputName}` : undefined}
        autoComplete={disableBrowserAutocomplete ? 'off' : undefined}
        autoCorrect={disableBrowserAutocomplete ? 'off' : undefined}
        autoCapitalize={disableBrowserAutocomplete ? 'off' : undefined}
        spellCheck={disableBrowserAutocomplete ? false : undefined}
        data-1p-ignore={disableBrowserAutocomplete ? true : undefined}
        data-lpignore={disableBrowserAutocomplete ? 'true' : undefined}
        data-form-type={disableBrowserAutocomplete ? 'other' : undefined}
        onChange={(e) => {
          const next = e.target.value;
          setQuery(next);
          onQueryChange?.(next);
          if (!open) setOpen(true);
          setHighlight(0);
        }}
        onFocus={(e) => {
          // Tab ile odaklanınca liste açılmaz; tıklama / yazma / ok tuşu açar
          if (selectAllOnFocus) {
            const el = e.currentTarget;
            window.requestAnimationFrame(() => {
              el.select();
            });
          }
        }}
        onClick={(e) => {
          if (!disabled) setOpen(true);
          if (selectAllOnFocus) {
            e.currentTarget.select();
          }
        }}
        onKeyDown={(e) => {
          if (disabled) return;
          if (e.key === 'Tab') {
            if (open) {
              setOpen(false);
              setQuery(displayLabel);
            }
            return;
          }
          if (e.key === 'ArrowDown') {
            e.preventDefault();
            if (!open) {
              setOpen(true);
              return;
            }
            setHighlight((h) => Math.min(h + 1, Math.max(filtered.length - 1, 0)));
            return;
          }
          if (e.key === 'ArrowUp') {
            e.preventDefault();
            if (!open) {
              setOpen(true);
              return;
            }
            setHighlight((h) => Math.max(h - 1, 0));
            return;
          }
          if (e.key === 'Enter' && open) {
            e.preventDefault();
            const hit = filtered[highlight];
            if (hit) pick(hit.value);
            return;
          }
          if (e.key === 'Escape' && open) {
            e.preventDefault();
            setOpen(false);
            setQuery(displayLabel);
          }
        }}
        className={inputClassName}
      />
      {open && !disabled && (
        <div
          id={listId}
          role="listbox"
          className="absolute z-30 mt-1 flex max-h-56 w-full flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg dark:border-slate-600 dark:bg-slate-800"
        >
          <div className="min-h-0 flex-1 overflow-y-auto">
          {loading ? (
            <div className="px-3 py-2.5 text-xs text-slate-500 dark:text-slate-400">{loadingText}</div>
          ) : filtered.length === 0 ? (
            <div className="px-3 py-2.5 text-xs text-slate-500 dark:text-slate-400">{emptyText}</div>
          ) : (
            filtered.map((o, idx) => (
              <button
                key={o.value}
                id={`${listId}-opt-${o.value}`}
                type="button"
                role="option"
                aria-selected={o.value === value}
                onMouseDown={(e) => e.preventDefault()}
                onMouseEnter={() => setHighlight(idx)}
                onClick={() => pick(o.value)}
                className={`flex w-full flex-col items-start px-3 py-2 text-left text-sm hover:bg-blue-50 dark:hover:bg-blue-900/20 ${
                  idx === highlight || o.value === value ? 'bg-blue-50/80 dark:bg-blue-900/30' : ''
                }`}
              >
                <span className="font-medium text-slate-800 dark:text-slate-100">{o.label}</span>
                {o.hint && (
                  <span className="text-[11px] text-slate-400 dark:text-slate-500">{o.hint}</span>
                )}
              </button>
            ))
          )}
          </div>
          {createAction ? (
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                setOpen(false);
                createAction.onSelect();
              }}
              className="block w-full border-t border-red-100 px-3 py-2 text-left text-xs font-semibold text-status-danger hover:bg-red-50 dark:border-red-900/40 dark:hover:bg-red-950/30"
            >
              {createAction.label}
            </button>
          ) : null}
        </div>
      )}
    </div>
  );
}
