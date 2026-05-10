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
}

const variantStyles = {
  default: 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900',
  premium:
    'border-slate-200/50 dark:border-slate-700/50 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm shadow-lg',
  alert: 'border-red-300 dark:border-red-800 bg-gradient-to-r from-red-600 to-orange-500 text-white',
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
}: WidgetFrameProps) {
  return (
    <div
      className={`overflow-hidden rounded-xl border shadow-sm transition-all duration-500 ease-out hover:shadow-md ${
        isLoaded ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-0'
      } ${variantStyles[variant]} ${className}`}
      style={{ transitionDelay: `${staggerIndex * 100}ms` }}
    >
      <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3.5 dark:border-slate-800">
        <div className="flex items-center gap-2.5">
          {icon && <div className="flex items-center justify-center">{icon}</div>}
          <div>
            <h3
              className={`text-sm font-semibold ${variant === 'alert' ? 'text-white' : 'text-slate-900 dark:text-white'}`}
            >
              {title}
            </h3>
            {subtitle && (
              <p
                className={`mt-0.5 text-xs ${variant === 'alert' ? 'text-white/80' : 'text-slate-500 dark:text-slate-400'}`}
              >
                {subtitle}
              </p>
            )}
          </div>
        </div>
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}
