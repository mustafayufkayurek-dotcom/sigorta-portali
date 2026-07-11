'use client';

import { ReactNode } from 'react';

interface WidgetFrameProps {
  title: string;
  subtitle?: string;
  icon?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  variant?: 'default' | 'premium' | 'alert';
  staggerIndex?: number;
  isLoaded?: boolean;
  compact?: boolean;
}

const variantStyles = {
  default: 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900',
  premium:
    'border-slate-200/50 dark:border-slate-700/50 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm shadow-lg',
  alert: 'border-red-200 dark:border-red-900/50 bg-white dark:bg-slate-900',
};

export function WidgetFrame({
  title,
  subtitle,
  icon,
  actions,
  children,
  className = '',
  variant = 'default',
  staggerIndex = 0,
  isLoaded = true,
  compact = false,
}: WidgetFrameProps) {
  return (
    <div
      className={`overflow-hidden rounded-lg border shadow-sm transition-all duration-500 ease-out hover:shadow-md ${
        isLoaded ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-0'
      } ${variantStyles[variant]} ${className}`}
      style={{ transitionDelay: `${staggerIndex * 100}ms` }}
    >
      <div
        className={`flex items-center justify-between border-b ${
          compact ? 'px-3 py-2' : 'px-5 py-3.5'
        } ${
          variant === 'alert'
            ? 'border-red-100 bg-red-50/70 dark:border-red-900/40 dark:bg-red-950/20'
            : 'border-slate-100 dark:border-slate-800'
        }`}
      >
        <div className="flex items-center gap-2.5">
          {icon && <div className="flex items-center justify-center">{icon}</div>}
          <div>
            <h3
              className={`text-sm font-semibold ${variant === 'alert' ? 'text-red-800 dark:text-red-200' : 'text-slate-900 dark:text-white'}`}
            >
              {title}
            </h3>
            {subtitle && (
              <p
                className={`mt-0.5 text-xs ${variant === 'alert' ? 'text-red-700/80 dark:text-red-200/70' : 'text-slate-500 dark:text-slate-400'}`}
              >
                {subtitle}
              </p>
            )}
          </div>
        </div>
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </div>
      <div className={compact ? 'p-3' : 'p-5'}>{children}</div>
    </div>
  );
}
