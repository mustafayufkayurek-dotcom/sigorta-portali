'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import axios from 'axios';
import { API, authHeader } from '@/utils/api';

type MetricKey =
  | 'departments'
  | 'customerTypes'
  | 'relationshipTypes'
  | 'serviceTypes'
  | 'locations'
  | 'serviceBranches'
  | 'workGroups'
  | 'claimSubjects'
  | 'documentTypes';

interface DefinitionMetric {
  total: number | null;
  active: number | null;
  note?: string;
  loading: boolean;
}

interface DashboardItem {
  key: MetricKey;
  title: string;
  purpose: string;
  owner: string;
  href: string;
  metaLabel: string;
  tone: 'blue' | 'emerald' | 'amber' | 'violet';
}

interface DashboardGroup {
  title: string;
  description: string;
  items: DashboardItem[];
}

const emptyMetric = (): DefinitionMetric => ({ total: null, active: null, loading: true });

const DASHBOARD_GROUPS: DashboardGroup[] = [
  {
    title: 'Kurumsal Tanımlar',
    description: 'Şirketin temel kurumsal sözlüklerini ve sahiplik ekranlarını gösterir.',
    items: [
      {
        key: 'departments',
        title: 'Departmanlar',
        purpose: 'Operasyon birimlerini ve rapor ilişkilerini sınıflandırır.',
        owner: 'Departman Yönetimi',
        href: '/panel/ayarlar/departmanlar',
        metaLabel: 'Toplam / aktif kayıt',
        tone: 'blue',
      },
      {
        key: 'customerTypes',
        title: 'Müşteri Tipleri',
        purpose: 'Müşteri kayıtlarında kullanılan kurumsal müşteri sınıflarını belirler.',
        owner: 'Müşteri Tipleri ekranı',
        href: '/panel/ayarlar/musteri-tipleri',
        metaLabel: 'Toplam / aktif kayıt',
        tone: 'blue',
      },
      {
        key: 'relationshipTypes',
        title: 'İlişki Türleri',
        purpose: 'Müşteri, eksper, tedarikçi ve dosya ilişkilerini adlandırır.',
        owner: 'İlişki Türleri ekranı',
        href: '/panel/ayarlar/iliski-turleri',
        metaLabel: 'Toplam / aktif kayıt',
        tone: 'blue',
      },
    ],
  },
  {
    title: 'Operasyonel Tanımlar',
    description: 'Saha ve operasyon akışında kullanılan tanım ailelerini gösterir.',
    items: [
      {
        key: 'serviceTypes',
        title: 'Hizmet Türleri',
        purpose: 'Sunulan hizmet sınıflarını ve operasyon ayrımlarını yönetir.',
        owner: 'Hizmet Türleri ekranı',
        href: '/panel/ayarlar/hizmet-turleri',
        metaLabel: 'Toplam / aktif kayıt',
        tone: 'emerald',
      },
      {
        key: 'locations',
        title: 'Mahal ve Bölgeler',
        purpose: 'Hasar raporunda kullanılan mahal/bölge sözlüğünü gösterir.',
        owner: 'Mahal ve Bölgeler ekranı',
        href: '/panel/ayarlar/mahaller',
        metaLabel: 'Toplam kayıt',
        tone: 'emerald',
      },
      {
        key: 'serviceBranches',
        title: 'Tedarikçi Branşları',
        purpose: 'Tedarikçi ve saha hizmet yetkinliklerini sınıflandırır.',
        owner: 'Tedarikçi Branşları ekranı',
        href: '/panel/ayarlar/hizmet-branslari',
        metaLabel: 'Toplam / aktif kayıt',
        tone: 'emerald',
      },
    ],
  },
  {
    title: 'Finansla İlişkili Tanımlar',
    description: 'Maliyetlendirme ve fiyat yönetimiyle ilişkili tanım ailesini gösterir.',
    items: [
      {
        key: 'workGroups',
        title: 'İş Grupları',
        purpose: 'Maliyetlendirme, fiyat listesi ve operasyon kalemlerinin ortak sözlüğüdür.',
        owner: 'İş Grupları / Fiyat Yönetimi sınırı',
        href: '/panel/ayarlar/is-gruplari',
        metaLabel: 'Toplam kayıt',
        tone: 'amber',
      },
    ],
  },
  {
    title: 'Dosya Yaşam Döngüsü Tanımları',
    description: 'Dosya açılışı ve evrak süreçlerinde kullanılan tanımların asıl sahiplerini gösterir.',
    items: [
      {
        key: 'claimSubjects',
        title: 'İhbar Konuları',
        purpose: 'Hasar ve acil yardım dosyalarının açılış konularını belirler.',
        owner: 'Dosya Yaşam Döngüsü',
        href: '/panel/ayarlar/ihbar-konulari',
        metaLabel: 'Asıl sahiplik',
        tone: 'violet',
      },
      {
        key: 'documentTypes',
        title: 'Evrak Türleri',
        purpose: 'Dosya süreçlerinde beklenen evrak kataloglarını yönetir.',
        owner: 'Dosya Yaşam Döngüsü / Evrak Standart Motoru',
        href: '/panel/ayarlar/evrak-turleri',
        metaLabel: 'Asıl sahiplik',
        tone: 'violet',
      },
    ],
  },
];

const TONE_CLASS: Record<DashboardItem['tone'], { bar: string; chip: string; icon: string }> = {
  blue: { bar: 'bg-blue-500', chip: 'bg-blue-50 text-blue-700 border-blue-100', icon: 'bg-blue-50 text-blue-700 ring-blue-100' },
  emerald: { bar: 'bg-emerald-500', chip: 'bg-emerald-50 text-emerald-700 border-emerald-100', icon: 'bg-emerald-50 text-emerald-700 ring-emerald-100' },
  amber: { bar: 'bg-amber-500', chip: 'bg-amber-50 text-amber-700 border-amber-100', icon: 'bg-amber-50 text-amber-700 ring-amber-100' },
  violet: { bar: 'bg-violet-500', chip: 'bg-violet-50 text-violet-700 border-violet-100', icon: 'bg-violet-50 text-violet-700 ring-violet-100' },
};

function extractArray(raw: any): any[] {
  if (Array.isArray(raw)) return raw;
  if (Array.isArray(raw?.data)) return raw.data;
  if (Array.isArray(raw?.values)) return raw.values;
  if (Array.isArray(raw?.types)) return raw.types;
  if (Array.isArray(raw?.items)) return raw.items;
  return [];
}

function countActive(items: any[]) {
  return items.filter((item) => item?.status === 'active' || item?.isActive === true || item?.active === true).length;
}

async function safeMetric(
  request: Promise<any>,
  map: (raw: any) => Omit<DefinitionMetric, 'loading'>,
): Promise<DefinitionMetric> {
  try {
    return { ...map((await request).data), loading: false };
  } catch {
    return { total: null, active: null, loading: false, note: 'Okunamadı' };
  }
}

function DefinitionDashboardCard({ item, metric }: { item: DashboardItem; metric: DefinitionMetric }) {
  const tone = TONE_CLASS[item.tone];
  const countText = metric.loading ? '...' : metric.total ?? '-';
  const activeText = metric.loading || metric.active === null ? null : `${metric.active} aktif`;

  return (
    <article className="relative overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm transition hover:border-blue-200 hover:shadow-md">
      <div className={`absolute inset-x-0 top-0 h-1 ${tone.bar}`} />
      <div className="space-y-4 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-slate-950">{item.title}</h3>
            <p className="mt-1 text-xs leading-5 text-slate-500">{item.purpose}</p>
          </div>
          <span className={`shrink-0 rounded-lg px-2 py-1 text-xs font-semibold ring-1 ${tone.icon}`}>
            {countText}
          </span>
        </div>
        <div className="space-y-2 text-xs text-slate-500">
          <div>
            <span className="font-semibold text-slate-700">Nerede yönetilir?</span>
            <p className="mt-0.5">{item.owner}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className={`rounded-full border px-2 py-1 font-semibold ${tone.chip}`}>{item.metaLabel}</span>
            {activeText ? <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-1">{activeText}</span> : null}
            {metric.note ? <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-1">{metric.note}</span> : null}
          </div>
        </div>
        <Link
          href={item.href}
          className="inline-flex items-center rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
        >
          Yönetim ekranına git
        </Link>
      </div>
    </article>
  );
}

export default function TanimlarPage() {
  const [metrics, setMetrics] = useState<Record<MetricKey, DefinitionMetric>>({
    departments: emptyMetric(),
    customerTypes: emptyMetric(),
    relationshipTypes: emptyMetric(),
    serviceTypes: emptyMetric(),
    locations: emptyMetric(),
    serviceBranches: emptyMetric(),
    workGroups: emptyMetric(),
    claimSubjects: emptyMetric(),
    documentTypes: emptyMetric(),
  });

  useEffect(() => {
    let alive = true;

    async function loadMetrics() {
      const headers = authHeader();
      const [
        departments,
        customerTypes,
        relationshipTypes,
        serviceTypes,
        locations,
        serviceBranches,
        workGroups,
        claimSubjects,
        documentTypes,
      ] = await Promise.all([
        safeMetric(axios.get(`${API}/departments`, { headers }), (raw) => {
          const items = extractArray(raw);
          return { total: items.length, active: countActive(items) };
        }),
        safeMetric(axios.get(`${API}/system-settings/customer-types`, { headers }), (raw) => {
          const items = extractArray(raw);
          return { total: items.length, active: countActive(items) };
        }),
        safeMetric(axios.get(`${API}/system-settings/relationship-types`, { headers }), (raw) => {
          const items = extractArray(raw);
          return { total: items.length, active: countActive(items) };
        }),
        safeMetric(axios.get(`${API}/service-types`, { headers }), (raw) => {
          const items = extractArray(raw);
          return { total: items.length, active: countActive(items) };
        }),
        safeMetric(axios.get(`${API}/claim-locations`, { headers }), (raw) => {
          const items = extractArray(raw);
          const childCount = items.reduce((sum, item) => sum + (Array.isArray(item?.subLocations) ? item.subLocations.length : 0), 0);
          return { total: items.length + childCount, active: countActive(items) };
        }),
        safeMetric(axios.get(`${API}/service-branches/admin`, { headers }), (raw) => {
          const items = extractArray(raw);
          return { total: items.length, active: countActive(items) };
        }),
        safeMetric(axios.get(`${API}/work-groups`, { headers }), (raw) => {
          const items = extractArray(raw);
          return { total: items.length, active: countActive(items), note: 'Fiyat Yönetimi ile ilişkili' };
        }),
        safeMetric(axios.get(`${API}/system-settings/ihbar-konulari`, { headers }), (raw) => {
          const data = raw?.data ?? raw ?? {};
          const hasar = Array.isArray(data.hasar) ? data.hasar.length : 0;
          const acil = Array.isArray(data.acil) ? data.acil.length : 0;
          return { total: hasar + acil, active: null, note: 'Dosya Yaşam Döngüsü sahibi' };
        }),
        safeMetric(axios.get(`${API}/document-types`, { headers }), (raw) => {
          const items = extractArray(raw);
          return { total: items.length, active: countActive(items), note: 'Evrak Standart Motoru ile ilişkili' };
        }),
      ]);

      if (!alive) return;
      setMetrics({
        departments,
        customerTypes,
        relationshipTypes,
        serviceTypes,
        locations,
        serviceBranches,
        workGroups,
        claimSubjects,
        documentTypes,
      });
    }

    loadMetrics();
    return () => { alive = false; };
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 px-5 py-4">
      <nav className="mx-auto mb-2 flex max-w-[1440px] items-center gap-1.5 text-xs text-slate-400">
        <a href="/panel" className="transition-colors hover:text-blue-600">Operasyon Paneli</a>
        <span>/</span>
        <a href="/panel/ayarlar" className="transition-colors hover:text-blue-600">Ayarlar</a>
        <span>/</span>
        <span className="font-medium text-slate-600">Tanımlar Merkezi</span>
      </nav>

      <div className="mx-auto max-w-[1440px] space-y-4">
        <div className="rounded-lg border border-slate-200 bg-white px-5 py-4 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <h1 className="text-xl font-semibold text-slate-950">Tanımlar Merkezi</h1>
              <p className="mt-1 max-w-4xl text-sm leading-5 text-slate-500">
                Tanım ailelerinin durumunu, sahipliğini ve nerede yönetildiğini gösterir. Kayıt girişi ilgili yönetim ekranlarında yapılır.
              </p>
            </div>
            <div className="flex flex-wrap gap-2 text-xs font-semibold">
              <span className="rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-blue-700">Dashboard rehberi</span>
              <span className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-slate-600">İkinci menü değil</span>
            </div>
          </div>
        </div>

        <div className="grid gap-4 xl:grid-cols-[1fr_320px]">
          <div className="space-y-4">
            {DASHBOARD_GROUPS.map((group) => (
              <section key={group.title} className="rounded-lg border border-slate-200 bg-white shadow-sm">
                <div className="border-b border-slate-100 px-5 py-4">
                  <h2 className="text-base font-semibold text-slate-950">{group.title}</h2>
                  <p className="mt-1 text-sm leading-5 text-slate-500">{group.description}</p>
                </div>
                <div className="grid gap-3 p-4 md:grid-cols-2 2xl:grid-cols-3">
                  {group.items.map((item) => (
                    <DefinitionDashboardCard key={item.key} item={item} metric={metrics[item.key]} />
                  ))}
                </div>
              </section>
            ))}
          </div>

          <aside className="space-y-4">
            <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-base font-semibold text-slate-950">Sahiplik Standardı</h2>
              <p className="mt-2 text-sm leading-5 text-slate-500">
                Tanımlar Merkezi kayıt düzenlemez. Her tanım ailesi kendi yönetim ekranında yönetilir; bu ekran yalnız durum ve yön gösterir.
              </p>
              <div className="mt-4 space-y-2 text-sm">
                <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                  <span className="font-semibold text-slate-800">Nerede yönetilir?</span>
                  <p className="mt-1 text-xs text-slate-500">Kart üzerindeki yönetim ekranı bağlantısı asıl sahibidir.</p>
                </div>
                <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                  <span className="font-semibold text-slate-800">Kaç kayıt var?</span>
                  <p className="mt-1 text-xs text-slate-500">Mevcut okuma endpointlerinden hesaplanan canlı özet gösterilir.</p>
                </div>
              </div>
            </section>

            <section className="rounded-lg border border-violet-100 bg-violet-50/60 p-5 shadow-sm">
              <h2 className="text-base font-semibold text-violet-950">Dosya Yaşam Döngüsü Notu</h2>
              <p className="mt-2 text-sm leading-5 text-violet-800">
                İhbar Konuları ve Evrak Türleri dosya yaşam döngüsü kararlarını etkiler. Bu nedenle Tanımlar Merkezi'nde yalnız rehber olarak görünür.
              </p>
            </section>
          </aside>
        </div>
      </div>
    </div>
  );
}
