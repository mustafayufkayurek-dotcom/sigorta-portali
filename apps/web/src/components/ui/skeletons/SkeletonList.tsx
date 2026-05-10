export function SkeletonList({ items = 4 }: { items?: number }) {
  return (
    <div className="animate-pulse space-y-3">
      {Array.from({ length: items }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800">
          <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-600" />
          <div className="flex-1 space-y-1.5">
            <div className="h-3 w-2/3 bg-slate-200 dark:bg-slate-600 rounded" />
            <div className="h-2.5 w-1/3 bg-slate-200 dark:bg-slate-600 rounded" />
          </div>
        </div>
      ))}
    </div>
  );
}
