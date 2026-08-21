'use client';

/**
 * Lokal: Hasar başlık etiketleri + Acil adres (ilçe · il).
 * Canlıya alınmadı. Production’da notFound.
 */

import { notFound } from 'next/navigation';
import { formatEmergencyFileAddress } from '@/utils/emergency-file-address';
import { formatHasarAdresi } from '@/utils/text-helpers';

const HASAR_ADDR = formatHasarAdresi({
  addressLine:
    'Yokuşbaşı Mh. Emin Anter Bulvarı No:25b D:4 Bodrum Tel : 05493384168 - İl (Muğla) - İlçe (Bodrum)',
  city: 'Muğla',
  district: 'Bodrum',
});

const ACIL_ADDR = formatEmergencyFileAddress({
  address:
    'Esenler Okulyolu Sırça Köşkler Sitesi A Blok No : 8 / 1 Daire : 2 Merkez - Türkiye - Çanakkale',
  district: null,
  city: null,
});

export default function DosyaBaslikAdresPreviewPage() {
  if (process.env.NODE_ENV === 'production') notFound();
  return (
    <div className="min-h-screen space-y-6 bg-[#f8fafc] p-4">
      <div className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-center text-xs font-medium text-amber-900">
        Lokal Önizleme · Canlı Sayfa Deploy Edilmedi
      </div>

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <p className="border-b border-slate-100 px-4 py-2 text-[11px] font-semibold text-slate-500">Hasar Dosyası</p>
        <div className="px-4 py-3">
          <p className="text-[11px] text-slate-400">Hasar Dosya No</p>
          <h2 className="text-lg font-bold text-slate-900">13501234210002</h2>
          <p className="mt-1 text-xs text-slate-500">
            Sigorta Şirketi: <span className="font-semibold text-slate-700">Anadolu Sigorta</span>
          </p>
          <p className="mt-1 text-sm font-medium text-slate-700">
            <span className="text-xs font-normal text-slate-400">Sigortalı Adı Soyadı: </span>
            Seval Saygı
          </p>
          <p className="mt-0.5 text-sm font-medium text-slate-700">
            <span className="text-xs font-normal text-slate-400">Sigortalı Telefon: </span>
            05493384168
          </p>
          <p className="mt-0.5 text-xs text-slate-500">
            <span className="text-slate-400">Dosya Konusu: </span>
            <span className="font-medium text-slate-700">Dahili Su</span>
          </p>
        </div>
        <div className="flex items-start gap-2 border-t border-slate-100 px-4 py-2 text-xs text-slate-600">
          <span className="shrink-0 text-slate-400">Hasar Adresi</span>
          <span className="font-medium">{HASAR_ADDR}</span>
        </div>
        <div className="flex items-center justify-between border-t border-slate-100 px-4 py-2.5">
          <div>
            <p className="text-[11px] font-semibold text-slate-600">Dosya Bilgileri</p>
            <p className="mt-0.5 text-xs text-slate-400">İhbar 15.08.2026 · M-Nihal Sigorta Ekspertiz</p>
          </div>
          <span className="text-xs font-medium text-slate-500">Detay</span>
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
        <p className="mb-2 text-[11px] font-semibold text-slate-500">Acil Yardım</p>
        <p className="text-xs text-slate-400">Adres</p>
        <p className="mt-0.5 text-sm font-medium leading-snug text-slate-800">{ACIL_ADDR}</p>
      </section>
    </div>
  );
}
