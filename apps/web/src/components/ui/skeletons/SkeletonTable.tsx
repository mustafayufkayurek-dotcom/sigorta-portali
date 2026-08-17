export function SkeletonTable({ rows = 5 }: { rows?: number }) {
  return (
    <div className="animate-pulse">
      <div className="h-10 bg-slate-100 dark:bg-slate-700 rounded-t-xl mb-1" />
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-12 bg-slate-50 dark:bg-slate-800 border-b border-slate-100 dark:border-slate-700 flex items-center gap-4 px-4">
          <div className="h-3 w-24 bg-slate-200 dark:bg-slate-600 rounded" />
          <div className="h-3 w-32 bg-slate-200 dark:bg-slate-600 rounded" />
          <div className="h-3 w-16 bg-slate-200 dark:bg-slate-600 rounded ml-auto" />
        </div>
      ))}
    </div>
  );
}
