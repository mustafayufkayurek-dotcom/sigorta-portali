'use client';

/**
 * GG.AA.YYYY — satıra odaklanınca klavyeden yazılır.
 * Takvim ikonu veya satıra ikinci tık ile açılır; yazımı bozmaz.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { Calendar } from 'lucide-react';
import {
  handleTrDateInputChange,
  normalizeTrDateValue,
  trDateInputDisplayValue,
} from '@/utils/tr-date-input';

type TrDateInputProps = {
  value: string;
  onChange: (value: string) => void;
  className?: string;
  placeholder?: string;
  id?: string;
  disabled?: boolean;
  'aria-label'?: string;
  /** Takvim ikonu açık (varsayılan: açık) */
  enablePicker?: boolean;
};

export function TrDateInput({
  value,
  onChange,
  className = '',
  placeholder = 'GG.AA.YYYY',
  id,
  disabled,
  'aria-label': ariaLabel,
  enablePicker = true,
}: TrDateInputProps) {
  const pickerRef = useRef<HTMLInputElement>(null);
  const textRef = useRef<HTMLInputElement>(null);
  const [focused, setFocused] = useState(false);
  const [draft, setDraft] = useState(() => trDateInputDisplayValue(value));

  useEffect(() => {
    if (!focused) {
      setDraft(trDateInputDisplayValue(value));
    }
  }, [value, focused]);

  const openPicker = useCallback(() => {
    if (disabled || !enablePicker) return;
    const el = pickerRef.current;
    if (!el) return;
    try {
      if (typeof el.showPicker === 'function') {
        el.showPicker();
      } else {
        el.click();
      }
    } catch {
      el.click();
    }
  }, [disabled, enablePicker]);

  const pickerValue = normalizeTrDateValue(value);
  const displayValue = focused ? draft : trDateInputDisplayValue(value);
  const inputClassName = enablePicker ? [className, 'pr-10'].filter(Boolean).join(' ') : className;
  const nativeDateClass =
    'appearance-none border-0 shadow-none outline-none ring-0 [&:invalid]:shadow-none [&:invalid]:outline-none [&:invalid]:ring-0 [&:invalid]:border-0';
  const textInputClass = `${inputClassName} [&:invalid]:shadow-none [&:invalid]:outline-none`;

  const applyText = (raw: string) => {
    const next = handleTrDateInputChange(raw);
    setDraft(trDateInputDisplayValue(next) || next);
    onChange(next);
  };

  const textInput = (
    <input
      ref={textRef}
      type="text"
      inputMode="text"
      autoComplete="off"
      spellCheck={false}
      maxLength={10}
      id={id}
      disabled={disabled}
      aria-label={ariaLabel ?? 'Tarih'}
      placeholder={placeholder}
      className={textInputClass}
      value={displayValue}
      onFocus={() => {
        setFocused(true);
        setDraft(trDateInputDisplayValue(value));
      }}
      onBlur={() => {
        setFocused(false);
        const iso = normalizeTrDateValue(draft);
        if (iso) {
          onChange(iso);
          setDraft(trDateInputDisplayValue(iso));
        } else {
          setDraft(trDateInputDisplayValue(value));
        }
      }}
      onChange={(e) => applyText(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === 'ArrowDown' && enablePicker) {
          e.preventDefault();
          openPicker();
        }
      }}
      data-testid="tr-date-text"
    />
  );

  if (!enablePicker) {
    return textInput;
  }

  return (
    <div className="relative w-full" data-testid="tr-date-input">
      {textInput}
      <input
        ref={pickerRef}
        type="date"
        tabIndex={-1}
        aria-hidden
        disabled={disabled}
        value={pickerValue}
        onChange={(e) => {
          const next = e.target.value;
          if (!next) return;
          onChange(next);
          setDraft(trDateInputDisplayValue(next));
          textRef.current?.focus();
        }}
        className={`pointer-events-none absolute bottom-0 right-0 h-0 w-0 opacity-0 ${nativeDateClass}`}
        data-testid="tr-date-picker"
      />
      <button
        type="button"
        tabIndex={-1}
        disabled={disabled}
        onMouseDown={(e) => {
          // Odak metinden kaçmasın; takvim açılsın
          e.preventDefault();
        }}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          openPicker();
        }}
        className="absolute inset-y-0 right-0 z-10 flex items-center px-2.5 text-slate-400 hover:text-slate-600 disabled:opacity-40"
        aria-label="Takvimden seç"
        data-testid="tr-date-calendar"
      >
        <Calendar className="h-4 w-4" aria-hidden />
      </button>
    </div>
  );
}
