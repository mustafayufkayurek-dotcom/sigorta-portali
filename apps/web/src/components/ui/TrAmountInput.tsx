'use client';

import {
  formatTrAmountInput,
  numberToTrAmountInput,
} from '@/utils/tr-amount-input';

type TrAmountInputProps = {
  value: string;
  onChange: (value: string) => void;
  className?: string;
  placeholder?: string;
  id?: string;
  disabled?: boolean;
  prefix?: string;
  prefixClassName?: string;
};

export function TrAmountInput({
  value,
  onChange,
  className = '',
  placeholder = '0',
  id,
  disabled,
  prefix = '',
  prefixClassName = 'absolute inset-y-0 left-3 flex items-center text-slate-400 text-sm pointer-events-none',
}: TrAmountInputProps) {
  const display = value.includes('.') || value.includes(',')
    ? value
    : value && /^\d+$/.test(value)
      ? numberToTrAmountInput(Number(value))
      : value;

  return (
    <div className="relative">
      {prefix ? <span className={prefixClassName}>{prefix}</span> : null}
      <input
        type="text"
        inputMode="decimal"
        id={id}
        disabled={disabled}
        placeholder={placeholder}
        className={`${className}${prefix ? ' pl-7' : ''}${prefix ? '' : ' pr-10'}`}
        value={display}
        onChange={(e) => onChange(formatTrAmountInput(e.target.value))}
      />
      {!prefix ? (
        <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-slate-400">
          TL
        </span>
      ) : null}
    </div>
  );
}
