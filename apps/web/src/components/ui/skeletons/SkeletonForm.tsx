export function SkeletonForm({ fields = 4 }: { fields?: number }) {
  return (
    <div className="animate-pulse space-y-4">
      {Array.from({ length: fields }).map((_, i) => (
        <div key={i}>
          <div className="h-3 w-20 bg-slate-200 dark:bg-slate-600 rounded mb-2" />
          <div className="h-10 w-full bg-slate-100 dark:bg-slate-700 rounded-xl" />
        </div>
      ))}
      <div className="h-10 w-32 bg-slate-200 dark:bg-slate-600 rounded-xl mt-6" />
    </div>
  );
}
