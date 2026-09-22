import { SkeletonCard } from '@/components/ui/skeletons/SkeletonCard';
import { SkeletonForm } from '@/components/ui/skeletons/SkeletonForm';

/**
 * Hasar dosya kabuğu — veri gelmeden beyaz sayfa yok.
 * Sahte müşteri / durum yazılmaz; yalnız gri şerit.
 */
export function HasarDosyaKabukSkeleton() {
  return (
    <div data-testid="hasar-dosya-yukleme-kabugu" aria-busy="true" aria-live="polite">
      <div className="mb-4 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center px-4 pt-2.5">
          <div className="h-4 w-12 animate-pulse rounded bg-slate-200" />
        </div>
        <div className="mx-4 mt-1.5 flex flex-wrap items-center gap-3 rounded-lg border border-blue-100/80 bg-blue-50/60 px-3 py-2">
          <div className="h-4 min-w-0 flex-1 animate-pulse rounded bg-blue-100" />
          <div className="h-7 w-24 animate-pulse rounded-md bg-blue-100" />
        </div>
        <div className="border-t border-slate-100 px-4 py-3">
          <div className="mb-3 h-4 w-28 animate-pulse rounded bg-slate-200" />
          <SkeletonForm fields={3} />
        </div>
      </div>

      <div className="mb-4 overflow-hidden rounded-2xl border border-slate-200/90 bg-white px-4 py-3 shadow-sm">
        <div className="h-4 w-24 animate-pulse rounded bg-slate-200" />
      </div>

      <div className="mb-4 flex flex-wrap gap-0 border-b border-slate-200">
        {['a', 'b', 'c', 'd', 'e'].map((k) => (
          <div key={k} className="px-3.5 py-2.5">
            <div className="h-4 w-16 animate-pulse rounded bg-slate-200" />
          </div>
        ))}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
      </div>
    </div>
  );
}
