'use client';

import { useState } from 'react';

export function Badge({ text, color }: { text: string; color: string }) {
  return <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${color}`}>{text}</span>;
}

export function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
      <h4 className="text-sm font-semibold text-slate-700 mb-4 border-b border-slate-100 pb-2">{title}</h4>
      {children}
    </div>
  );
}

export function CollapsibleSectionCard({
  title,
  children,
  defaultOpen = false,
  subtitle,
}: {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
  subtitle?: string;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left hover:bg-slate-50/80 transition-colors"
      >
        <div className="min-w-0">
          <h4 className="text-sm font-semibold text-slate-700">{title}</h4>
          {subtitle && !open && <p className="text-xs text-slate-400 mt-0.5 truncate">{subtitle}</p>}
        </div>
        <span className="text-xs font-medium text-brand-600 shrink-0">{open ? 'Gizle' : 'Detayları Göster'}</span>
      </button>
      {open && <div className="px-4 pb-4 pt-0 border-t border-slate-100">{children}</div>}
    </div>
  );
}
