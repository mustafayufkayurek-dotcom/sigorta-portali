'use client';

export function SubTabNav<T extends string>({
  tabs,
  active,
  onChange,
}: {
  tabs: { id: T; label: string }[];
  active: T;
  onChange: (id: T) => void;
}) {
  return (
    <div className="sticky top-[52px] z-10 -mx-1 px-1 py-2 bg-[#f8fafc]/95 backdrop-blur-sm">
      <div className="flex gap-1.5 overflow-x-auto pb-0.5">
        {tabs.map((tab) => (
          <button
            type="button"
            key={tab.id}
            onClick={() => onChange(tab.id)}
            className={`shrink-0 px-4 py-2 text-sm font-medium rounded-lg transition-all ${
              active === tab.id
                ? 'bg-white text-blue-700 shadow-sm ring-1 ring-slate-200'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>
    </div>
  );
}
