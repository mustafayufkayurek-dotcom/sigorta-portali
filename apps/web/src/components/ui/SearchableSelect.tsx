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
  disabled?: boolean;
  className?: string;
  inputClassName?: string;
  /** Tarayıcı adres/otomatik doldurma menüsünü kapatır */
  disableBrowserAutocomplete?: boolean;
}

const normalizeSearchDigits = (s: string) => s.replace(/\D/g, '');

export function SearchableSelect({
  options,
  value,
  onChange,
  onQueryChange,
  placeholder = 'Ara veya seç...',
  emptyText = 'Sonuç bulunamadı',
  disabled = false,
  className = '',
  inputClassName = '',
  disableBrowserAutocomplete = false,
}: SearchableSelectProps) {
  const listId = useId();
  const inputName = useId().replace(/:/g, '');
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const selected = options.find((o) => o.value === value);

  useEffect(() => {
    if (!open) setQuery(selected?.label ?? '');
  }, [open, selected?.label]);

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

  const pick = (next: string) => {
    onChange(next);
    const opt = options.find((o) => o.value === next);
    setQuery(opt?.label ?? '');
    setOpen(false);
  };

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <input
        type="search"
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        disabled={disabled}
        placeholder={placeholder}
        value={open ? query : (selected?.label ?? query)}
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
        }}
        onFocus={() => setOpen(true)}
        className={inputClassName}
      />
      {open && !disabled && (
        <div
          id={listId}
          className="absolute z-30 mt-1 max-h-56 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-lg dark:border-slate-600 dark:bg-slate-800"
        >
          {filtered.length === 0 ? (
            <div className="px-3 py-2.5 text-xs text-slate-500 dark:text-slate-400">{emptyText}</div>
          ) : (
            filtered.map((o) => (
              <button
                key={o.value}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => pick(o.value)}
                className={`flex w-full flex-col items-start px-3 py-2 text-left text-sm hover:bg-blue-50 dark:hover:bg-blue-900/20 ${
                  o.value === value ? 'bg-blue-50/80 dark:bg-blue-900/30' : ''
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
      )}
    </div>
  );
}
