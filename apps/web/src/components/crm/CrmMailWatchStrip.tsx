'use client';

import type { CrmMailWatch } from '@sigorta/shared';

export function CrmMailWatchStrip({ watch }: { watch: CrmMailWatch }) {
  if (watch === 'bounced') {
    return (
      <div>
        <span className="badge badge-red">Ulaşmadı</span>
        <p className="mt-1 text-[11px] text-red-700">Adres geri çevirdi. Kontrol edip yeniden gönderin.</p>
      </div>
    );
  }
  return (
    <div>
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="badge badge-green">Gönderildi</span>
        <span className={watch === 'replied' ? 'badge badge-green' : 'badge badge-gray'}>
          {watch === 'replied' ? 'Yanıt geldi' : 'Yanıt yok'}
        </span>
      </div>
      {watch === 'replied' ? (
        <p className="mt-1 text-[11px] text-emerald-800">Karşı taraf yazdı. Maili görmüştür.</p>
      ) : (
        <p className="mt-1 text-[11px] text-slate-500">Kesin teyit: karşı tarafın Alındı yazması.</p>
      )}
    </div>
  );
}
