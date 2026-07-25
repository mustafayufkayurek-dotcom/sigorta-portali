'use client';

import Link from 'next/link';
import { BadgeCheck, Building2, FileCheck2, Lock, ShieldCheck } from 'lucide-react';

const TRUST_ITEMS = [
  { icon: ShieldCheck, label: 'KVKK Uyumlu Operasyon Yönetimi' },
  { icon: Lock, label: 'Müşteri ve Sigortalı Gizliliği' },
  { icon: Building2, label: 'Kamu Kurumları Bilgi Güvenliği' },
  { icon: FileCheck2, label: 'Gizlilik Sözleşmelerine (NDA) Tam Uyum' },
  { icon: BadgeCheck, label: 'Referanslar Gerçek Operasyonlardan Seçilmiştir' },
];

export default function OperationReferencePrivacySection() {
  return (
    <section className="rounded-xl border border-slate-200 bg-white px-4 py-4 shadow-sm sm:px-5">
      <h2 className="text-sm font-semibold text-slate-900">
        Operasyon Gizliliği ve Veri Güvenliği Taahhüdümüz
      </h2>
      <p className="mt-2 max-w-5xl text-xs leading-relaxed text-slate-600">
        Meridyen Assistance olarak; KVKK, ticari sırların korunması, sigorta şirketleri ile yapılan
        gizlilik sözleşmeleri (NDA) ve kamu kurumlarına ilişkin bilgi güvenliği yükümlülükleri
        kapsamında operasyon fotoğrafları, ekspertiz görüntüleri, hasar kayıtları ve müşteri
        bilgileri bu platformda paylaşılmamaktadır. Harita üzerinde yer alan referanslar, Meridyen
        tarafından başarıyla tamamlanmış gerçek operasyonlardan seçilmiş olup yalnızca operasyon
        kabiliyeti ve uzmanlık alanlarını temsil etmektedir.
      </p>
      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {TRUST_ITEMS.map((item) => (
          <div
            key={item.label}
            className="flex items-center gap-2.5 rounded-lg border border-slate-100 bg-slate-50/80 px-3 py-2.5"
          >
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white text-blue-600 shadow-sm">
              <item.icon className="h-4 w-4" aria-hidden="true" />
            </div>
            <p className="text-[11px] font-medium leading-snug text-slate-700">{item.label}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

export function OperationReferenceFooterBand() {
  return (
    <div className="rounded-xl bg-[#0B1F3A] px-4 py-3 sm:px-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="max-w-3xl text-xs leading-relaxed text-blue-100/90 sm:text-[13px]">
          Meridyen Assistance; operasyonel başarılarını görsellerle değil, sürdürülebilir hizmet
          kalitesi, kurumsal güven ve referans operasyon deneyimiyle temsil etmeyi ilke edinmiştir.
        </p>
        <Link
          href="/panel"
          className="inline-flex shrink-0 items-center justify-center rounded-lg border border-white/20 bg-white/10 px-4 py-2 text-xs font-semibold text-white transition hover:bg-white/15"
        >
          Meridyen Hakkında Daha Fazla →
        </Link>
      </div>
    </div>
  );
}
