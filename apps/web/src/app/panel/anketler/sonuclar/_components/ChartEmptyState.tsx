'use client';

import { BarChart3 } from 'lucide-react';

/** Kompakt boş grafik alanı — kart yüksekliğini şişirmez */
export function ChartEmptyState({ tall }: { tall?: boolean }) {
  return (
    <div
      className={`flex flex-col items-center justify-center px-3 text-center ${
        tall ? 'h-full min-h-[360px]' : 'h-[168px]'
      }`}
    >
      <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-slate-100 text-slate-400">
        <BarChart3 className="h-3.5 w-3.5" />
      </span>
      <p className="mt-1.5 text-xs font-medium text-slate-600">
        Bu tarih aralığında henüz yeterli veri oluşmadı.
      </p>
      <p className="mt-0.5 line-clamp-1 text-[11px] text-slate-400">
        İlk anket tamamlandığında grafik burada gösterilecektir.
      </p>
    </div>
  );
}
