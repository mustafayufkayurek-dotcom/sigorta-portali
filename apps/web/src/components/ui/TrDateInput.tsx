'use client';

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
  /** Tıklama/odakta native takvim açılır (varsayılan: açık) */
  enablePicker?: boolean;
};

/** Mobil / dokunmatik: sayısal klavye yerine native tarih seçici */
function prefersNativeDateOverlay(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(pointer: coarse), (max-width: 767px)').matches;
}

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
  const [nativeOverlay, setNativeOverlay] = useState(false);

  useEffect(() => {
    if (!enablePicker) {
      setNativeOverlay(false);
      return;
    }
    const media = window.matchMedia('(pointer: coarse), (max-width: 767px)');
    const sync = () => setNativeOverlay(media.matches);
    sync();
    media.addEventListener('change', sync);
    return () => media.removeEventListener('change', sync);
  }, [enablePicker]);

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
  const displayValue = trDateInputDisplayValue(value);
  const inputClassName = enablePicker ? [className, 'pr-9'].filter(Boolean).join(' ') : className;

  if (enablePicker && nativeOverlay) {
    return (
      <div className="relative w-full">
        <div
          id={id}
          className={`${inputClassName} pointer-events-none flex items-center ${!displayValue ? 'text-slate-400' : ''}`}
          aria-hidden
        >
          <span className="truncate">{displayValue || placeholder}</span>
        </div>
        <input
          ref={pickerRef}
          type="date"
          disabled={disabled}
          aria-label={ariaLabel ?? 'Tarih seç'}
          value={pickerValue}
          onChange={(e) => {
            const next = e.target.value;
            if (next) onChange(next);
          }}
          className="absolute inset-0 z-[1] h-full w-full cursor-pointer opacity-0"
        />
        <span
          className="pointer-events-none absolute inset-y-0 right-0 z-[2] flex items-center px-2.5 text-slate-400"
          aria-hidden
        >
          <Calendar className="h-4 w-4" />
        </span>
      </div>
    );
  }

  const textInput = (
    <input
      type="text"
      inputMode="numeric"
      maxLength={10}
      id={id}
      disabled={disabled}
      aria-label={ariaLabel}
      placeholder={placeholder}
      className={inputClassName}
      value={displayValue}
      onChange={(e) => onChange(handleTrDateInputChange(e.target.value))}
      onFocus={enablePicker ? openPicker : undefined}
      onClick={enablePicker ? openPicker : undefined}
    />
  );

  if (!enablePicker) {
    return textInput;
  }

  return (
    <div className="relative w-full">
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
          if (next) onChange(next);
        }}
        className="absolute bottom-0 right-0 h-0 w-0 opacity-0 pointer-events-none"
      />
      <button
        type="button"
        tabIndex={-1}
        disabled={disabled}
        onClick={openPicker}
        className="absolute inset-y-0 right-0 flex items-center px-2.5 text-slate-400 hover:text-slate-600 disabled:opacity-40"
        aria-label="Tarih seç"
      >
        <Calendar className="h-4 w-4" aria-hidden />
      </button>
    </div>
  );
}
