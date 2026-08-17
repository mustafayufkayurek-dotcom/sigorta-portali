'use client';

export function CollapsibleFormPanel({
  title,
  hint,
  children,
  accent,
  open,
  onToggle,
  summary,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
  accent?: 'emerald' | 'slate';
  open: boolean;
  onToggle: () => void;
  summary?: string;
}) {
  const head =
    accent === 'emerald'
      ? 'bg-emerald-50/60 border-emerald-100'
      : 'bg-slate-50/80 border-slate-100';
  const titleCls = accent === 'emerald' ? 'text-emerald-800' : 'text-slate-600';
  const hintCls = accent === 'emerald' ? 'text-emerald-700/80' : 'text-slate-400';

  return (
    <section className="rounded-xl border border-slate-200 overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        className={`w-full flex items-start justify-between gap-3 px-3 py-2.5 text-left border-b transition-colors hover:bg-slate-50/80 ${open ? head : 'bg-white border-transparent'}`}
        aria-expanded={open}
      >
        <div className="min-w-0 flex-1">
          <p className={`text-xs font-medium ${titleCls}`}>{title}</p>
          {open && hint && <p className={`text-[11px] mt-0.5 ${hintCls}`}>{hint}</p>}
          {!open && summary && (
            <p className="text-[11px] mt-0.5 text-slate-500 truncate">{summary}</p>
          )}
        </div>
        <svg
          className={`w-4 h-4 text-slate-400 shrink-0 mt-0.5 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && <div className="p-3">{children}</div>}
    </section>
  );
}
