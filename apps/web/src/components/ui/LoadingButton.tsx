'use client';

import { ButtonHTMLAttributes, ReactNode } from 'react';

interface LoadingButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  loading?: boolean;
  variant?: 'primary' | 'danger' | 'secondary';
  children: ReactNode;
}

export function LoadingButton({ loading = false, variant = 'primary', children, disabled, className = '', ...props }: LoadingButtonProps) {
  const base = 'inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed';
  const variants = {
    primary: 'bg-brand-600 hover:bg-brand-700 text-white shadow-sm',
    danger: 'bg-status-danger hover:bg-red-600 text-white shadow-sm',
    secondary: 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200',
  };

  return (
    <button disabled={disabled || loading} className={`${base} ${variants[variant]} ${className}`} {...props}>
      {loading && (
        <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      )}
      {children}
    </button>
  );
}