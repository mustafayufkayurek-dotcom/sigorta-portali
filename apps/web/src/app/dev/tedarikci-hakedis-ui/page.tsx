'use client';

/**
 * Yerel UI önizleme — HasarFileHakedisPanel revizyonunun görsel doğrulaması.
 * Production route değildir; /dev altında kalır.
 */
import { useState } from 'react';
import { notFound } from 'next/navigation';

type TabId = 'avans' | 'hakedis' | 'odeme';

const fmt = (n: number) =>
  `₺ ${n.toLocaleString('tr-TR', { maximumFractionDigits: 0 })}`;

function Card({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="min-w-0 rounded-xl border border-slate-200 bg-white px-4 py-3.5">
      <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-2 text-xl font-semibold tabular-nums tracking-tight text-slate-900">{value}</p>
      {hint ? <p className="mt-1.5 text-[11px] leading-snug text-slate-400">{hint}</p> : null}
    </div>
  );
}

function Badge({ label, tone }: { label: string; tone: 'blue' | 'green' | 'amber' }) {
  const cls =
    tone === 'green'
      ? 'bg-emerald-50 text-emerald-800 border-emerald-100'
      : tone === 'amber'
        ? 'bg-amber-50 text-amber-800 border-amber-100'
        : 'bg-blue-50 text-blue-800 border-blue-100';
  return (
    <span className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] ${cls}`}>{label}</span>
  );
}

export default function TedarikciHakedisUiPreviewPage() {
  if (process.env.NODE_ENV === 'production') notFound();

  const [tab, setTab] = useState<TabId>('avans');

  return (
    <main className="min-h-screen bg-slate-100 p-4 sm:p-8">
      <div className="mx-auto max-w-[42rem]">
        <p className="mb-3 text-xs font-medium text-slate-500">
          Geliştirme · Tedarikçi Hakediş UI Önizleme · Production değil
        </p>

        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
          <header className="border-b border-slate-100 px-5 py-4">
            <h1 className="text-sm font-semibold text-slate-900">Hakediş Yönetimi</h1>
            <p className="mt-1 truncate text-sm text-slate-600">Örnek Tedarikçi A.Ş. · DOS-2026-0042</p>
            <span className="mt-2 inline-flex rounded-full border border-blue-100 bg-blue-50 px-2 py-0.5 text-[11px] font-medium text-blue-800">
              30 gün vade
            </span>

            <div className="mt-3 flex border-b border-slate-200" role="tablist">
              {(
                [
                  { id: 'avans' as const, label: 'Avans İşlemleri' },
                  { id: 'hakedis' as const, label: 'Hakediş İşlemleri' },
                  { id: 'odeme' as const, label: 'Ödeme Planı' },
                ]
              ).map((t) => (
                <button
                  key={t.id}
                  type="button"
                  role="tab"
                  aria-selected={tab === t.id}
                  onClick={() => setTab(t.id)}
                  className={`border-b-2 px-3.5 py-2.5 text-sm font-medium ${
                    tab === t.id
                      ? '-mb-px border-slate-800 text-slate-900'
                      : 'border-transparent text-slate-500 hover:text-slate-800'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </header>

          <div className="space-y-4 px-5 py-4">
            {tab === 'avans' ? (
              <>
                <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3" data-testid="preview-avans-kartlar">
                  <Card label="Toplam Avans" value={fmt(250000)} hint="2 işlem · Son işlem 18 Ağustos 2026" />
                  <Card label="Kullanılan Avans" value={fmt(15000)} />
                  <Card label="Kalan Avans Hakkı" value={fmt(235000)} hint="Limit %20 · Maks. ₺ 490.000" />
                </div>

                <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200">
                  <li className="flex items-center justify-between gap-3 px-3.5 py-3 text-sm">
                    <span>
                      <span className="font-medium text-slate-800">Avans Ödemesi</span>
                      <span className="mt-0.5 block text-[11px] text-slate-400">18 Ağu 2026 · Ödendi</span>
                    </span>
                    <span className="font-semibold tabular-nums">{fmt(150000)}</span>
                  </li>
                  <li className="flex items-center justify-between gap-3 px-3.5 py-3 text-sm">
                    <span>
                      <span className="font-medium text-slate-800">Avans Talebi</span>
                      <span className="mt-0.5 block text-[11px] text-slate-400">10 Ağu 2026 · Onay Bekliyor</span>
                    </span>
                    <span className="font-semibold tabular-nums">{fmt(100000)}</span>
                  </li>
                </ul>

                <div className="space-y-3 rounded-xl border border-slate-200 p-4">
                  <p className="text-xs font-semibold text-slate-800">Yeni Avans</p>
                  <label className="block">
                    <span className="text-[11px] font-medium text-slate-500">
                      Açıklama <span className="text-red-500">*</span>
                    </span>
                    <textarea
                      rows={2}
                      defaultValue="Malzeme peşinatı — boya ve yalıtım"
                      className="mt-1.5 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none"
                    />
                  </label>
                  <label className="block">
                    <span className="text-[11px] font-medium text-slate-500">Tutar</span>
                    <input
                      defaultValue="75.000"
                      className="mt-1.5 w-full rounded-lg border border-slate-200 px-3 py-2 text-right text-sm tabular-nums outline-none"
                    />
                  </label>
                  <p className="text-[11px] text-slate-400">Para birimi tek yerde: tutar alanı sayı, özet kartlarda ₺</p>
                  <button type="button" className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white">
                    Avans Kaydet
                  </button>
                </div>
              </>
            ) : null}

            {tab === 'hakedis' ? (
              <>
                <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4" data-testid="preview-hakedis-kartlar">
                  <Card label="Sözleşme Tutarı" value={fmt(2450000)} />
                  <Card label="Toplam Hakediş" value={fmt(1280000)} />
                  <Card label="Ödenen" value={fmt(950000)} />
                  <Card label="Kalan Hakediş" value={fmt(330000)} />
                </div>
                <div className="rounded-xl border border-slate-200 bg-white px-4 py-3.5">
                  <div className="flex items-baseline justify-between gap-3">
                    <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">Hakediş Gerçekleşme</p>
                    <p className="text-sm font-semibold tabular-nums text-slate-900">%52,2</p>
                  </div>
                  <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-slate-100">
                    <div className="h-full w-[52.2%] rounded-full bg-slate-800" />
                  </div>
                </div>

                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-semibold text-slate-800">Hakediş Listesi</p>
                  <button type="button" className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white">
                    Hakediş Oluştur
                  </button>
                </div>

                <div className="overflow-x-auto rounded-xl border border-slate-200">
                  <table className="min-w-full text-left text-[12px]">
                    <thead className="bg-slate-50 text-[11px] font-medium text-slate-500">
                      <tr>
                        <th className="px-3 py-2">Hakediş No</th>
                        <th className="px-3 py-2">Dönem</th>
                        <th className="px-3 py-2">Hakediş Tutarı</th>
                        <th className="px-3 py-2">Kesintiler</th>
                        <th className="px-3 py-2">Net Tutar</th>
                        <th className="px-3 py-2">Durum</th>
                        <th className="px-3 py-2">İşlem</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      <tr>
                        <td className="px-3 py-2.5 font-medium">H-004</td>
                        <td className="px-3 py-2.5 text-slate-600">Ağustos 2026</td>
                        <td className="px-3 py-2.5 tabular-nums">{fmt(285000)}</td>
                        <td className="px-3 py-2.5 tabular-nums text-slate-600">{fmt(15000)}</td>
                        <td className="px-3 py-2.5 tabular-nums font-semibold">{fmt(270000)}</td>
                        <td className="px-3 py-2.5"><Badge label="Onay Bekliyor" tone="blue" /></td>
                        <td className="px-3 py-2.5 text-xs font-semibold text-blue-700">Detay</td>
                      </tr>
                      <tr>
                        <td className="px-3 py-2.5 font-medium">H-003</td>
                        <td className="px-3 py-2.5 text-slate-600">Temmuz 2026</td>
                        <td className="px-3 py-2.5 tabular-nums">{fmt(310000)}</td>
                        <td className="px-3 py-2.5 tabular-nums text-slate-600">{fmt(18000)}</td>
                        <td className="px-3 py-2.5 tabular-nums font-semibold">{fmt(292000)}</td>
                        <td className="px-3 py-2.5"><Badge label="Ödendi" tone="green" /></td>
                        <td className="px-3 py-2.5 text-xs font-semibold text-blue-700">Detay</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                <div className="space-y-3 rounded-xl border border-slate-200 p-4">
                  <p className="text-xs font-semibold text-slate-800">H-004 · Durum Akışı</p>
                  <ol className="flex flex-wrap items-center gap-2 text-[11px] font-medium">
                    <li className="text-emerald-700">✓ Taslak</li>
                    <li className="text-slate-300">→</li>
                    <li className="text-emerald-700">✓ Kontrol</li>
                    <li className="text-slate-300">→</li>
                    <li className="text-blue-700">● Onay</li>
                    <li className="text-slate-300">→</li>
                    <li className="text-slate-400">○ Ödeme</li>
                    <li className="text-slate-300">→</li>
                    <li className="text-slate-400">○ Tamamlandı</li>
                  </ol>
                </div>
              </>
            ) : null}

            {tab === 'odeme' ? (
              <>
                <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4" data-testid="preview-odeme-kartlar">
                  <Card label="Planlanan Ödeme" value={fmt(680000)} />
                  <Card label="Bu Ay" value={fmt(285000)} />
                  <Card label="Ödenen" value={fmt(395000)} />
                  <Card label="Yaklaşan" value={fmt(285000)} />
                </div>
                <div className="overflow-x-auto rounded-xl border border-slate-200">
                  <table className="min-w-full text-left text-[12px]">
                    <thead className="bg-slate-50 text-[11px] font-medium text-slate-500">
                      <tr>
                        <th className="px-3 py-2">Tarih</th>
                        <th className="px-3 py-2">Hakediş</th>
                        <th className="px-3 py-2">Tutar</th>
                        <th className="px-3 py-2">Ödeme Durumu</th>
                        <th className="px-3 py-2">İşlem</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {[
                        ['05.09.2026', 'H-004', 285000],
                        ['05.10.2026', 'H-005', 210000],
                        ['05.11.2026', 'H-006', 185000],
                      ].map(([tarih, no, tutar]) => (
                        <tr key={String(no)}>
                          <td className="px-3 py-2.5 text-slate-600">{tarih}</td>
                          <td className="px-3 py-2.5 font-medium">{no}</td>
                          <td className="px-3 py-2.5 tabular-nums font-semibold">{fmt(Number(tutar))}</td>
                          <td className="px-3 py-2.5"><Badge label="Planlandı" tone="blue" /></td>
                          <td className="px-3 py-2.5 text-xs font-semibold text-blue-700">Detay</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            ) : null}
          </div>

          <footer className="flex items-center justify-between gap-2 border-t border-slate-100 px-5 py-3">
            <div>
              <p className="text-[11px] text-slate-500">Ödenecek Net</p>
              <p className="text-base font-semibold tabular-nums">{fmt(330000)}</p>
            </div>
            <button type="button" className="rounded-lg px-3 py-2 text-sm text-slate-600 hover:bg-slate-50">
              Kapat
            </button>
          </footer>
        </section>
      </div>
    </main>
  );
}
