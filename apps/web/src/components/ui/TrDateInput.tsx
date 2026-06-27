'use client';

import {
  handleTrDateInputChange,
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
};

export function TrDateInput({
  value,
  onChange,
  className = '',
  placeholder = 'GG.AA.YYYY',
  id,
  disabled,
  'aria-label': ariaLabel,
}: TrDateInputProps) {
  return (
    <input
      type="text"
      inputMode="numeric"
      maxLength={10}
      id={id}
      disabled={disabled}
      aria-label={ariaLabel}
      placeholder={placeholder}
      className={className}
      value={trDateInputDisplayValue(value)}
      onChange={(e) => onChange(handleTrDateInputChange(e.target.value))}
    />
  );
}
