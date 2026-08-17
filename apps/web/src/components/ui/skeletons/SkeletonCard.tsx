export function SkeletonCard() {
  return (
    <div className="rounded-2xl border border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-800 p-4 animate-pulse">
      <div className="flex items-center gap-3 mb-3">
        <div className="w-10 h-10 rounded-xl bg-slate-200 dark:bg-slate-600" />
        <div className="flex-1 space-y-2">
          <div className="h-3 w-20 bg-slate-200 dark:bg-slate-600 rounded" />
          <div className="h-5 w-16 bg-slate-200 dark:bg-slate-600 rounded" />
        </div>
      </div>
    </div>
  );
}
