'use client';

import type { ReactNode } from 'react';
import { toTitleCaseTR } from '@/utils/text-helpers';

export const claimFileInputClass =
  'w-full border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 disabled:opacity-60';

export const claimFileSelectClass =
  'w-full border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 disabled:opacity-60';

export function ClaimFileFieldInput({
  label,
  value,
  onChange,
  onBlurTitleCase,
  required,
  disabled,
  placeholder,
  multiline,
  error,
  type = 'text',
  onBlur,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  onBlurTitleCase?: boolean;
  required?: boolean;
  disabled?: boolean;
  placeholder?: string;
  multiline?: boolean;
  error?: string;
  type?: string;
  onBlur?: () => void;
}) {
  const cls = error
    ? `${claimFileInputClass} border-red-400 ring-2 ring-status-danger/20`
    : claimFileInputClass;

  return (
    <div>
      <label className="block text-xs font-medium text-slate-600 mb-1.5">
        {label}
        {required && <span className="text-status-danger ml-0.5">*</span>}
      </label>
      {multiline ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={
            onBlurTitleCase || onBlur
              ? (e) => {
                  if (onBlurTitleCase) {
                    const v = toTitleCaseTR(e.target.value.trim());
                    if (v) onChange(v);
                  }
                  onBlur?.();
                }
              : undefined
          }
          rows={2}
          disabled={disabled}
          placeholder={placeholder}
          className={`${cls} resize-none`}
        />
      ) : (
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={
            onBlurTitleCase || onBlur
              ? (e) => {
                  if (onBlurTitleCase) {
                    const v = toTitleCaseTR(e.target.value.trim());
                    if (v) onChange(v);
                  }
                  onBlur?.();
                }
              : undefined
          }
          disabled={disabled}
          placeholder={placeholder}
          className={cls}
        />
      )}
      {error && <p className="text-xs text-status-danger mt-0.5">{error}</p>}
    </div>
  );
}

export function ClaimFileSection({
  title,
  subtitle,
  variant = 'default',
  children,
}: {
  title: string;
  subtitle?: string;
  variant?: 'default' | 'emerald';
  children: ReactNode;
}) {
  const isEmerald = variant === 'emerald';
  return (
    <section
      className={
        isEmerald
          ? 'rounded-xl border border-emerald-200 bg-emerald-50/30 overflow-hidden'
          : 'rounded-xl border border-slate-200 overflow-hidden bg-white'
      }
    >
      <div
        className={
          isEmerald
            ? 'px-3 py-2 border-b border-emerald-100 bg-emerald-50/60'
            : 'px-3 py-2 bg-slate-50/80 border-b border-slate-100'
        }
      >
        <p className={`text-xs font-medium ${isEmerald ? 'text-emerald-800' : 'text-slate-600'}`}>
          {title}
        </p>
        {subtitle && (
          <p className={`text-[11px] mt-0.5 ${isEmerald ? 'text-emerald-700/80' : 'text-slate-500'}`}>
            {subtitle}
          </p>
        )}
      </div>
      <div className="p-3">{children}</div>
    </section>
  );
}
