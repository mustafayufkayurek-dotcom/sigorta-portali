'use client';

import { ReactNode, useState } from 'react';

interface SectionCardProps {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
  collapsible?: boolean;
  defaultOpen?: boolean;
  icon?: ReactNode;
  className?: string;
}

export function SectionCard({
  title,
  subtitle,
  actions,
  children,
  collapsible = false,
  defaultOpen = true,
  icon,
  className = '',
}: SectionCardProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className={`overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm ${className}`}>
      <div
        className={`flex items-center justify-between px-4 py-3 ${collapsible ? 'cursor-pointer hover:bg-gray-50' : ''}`}
        onClick={() => collapsible && setOpen(!open)}
      >
        <div className="flex items-center gap-2">
          {icon}
          <div>
            <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
            {subtitle && <p className="mt-0.5 text-xs text-gray-500">{subtitle}</p>}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {actions && <div onClick={(e) => e.stopPropagation()}>{actions}</div>}
          {collapsible && (
            <svg
              className={`h-4 w-4 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          )}
        </div>
      </div>
      {(!collapsible || open) && (
        <div className="border-t border-gray-100 px-4 py-3">{children}</div>
      )}
    </div>
  );
}
