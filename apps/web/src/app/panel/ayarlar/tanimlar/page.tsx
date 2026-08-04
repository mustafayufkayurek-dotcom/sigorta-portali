'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import axios from 'axios';
import { SettingsPageLayout } from '@/components/settings/SettingsPageLayout';
import { API, authHeader } from '@/utils/api';

type MetricKey =
  | 'departments'
  | 'relationshipTypes'
  | 'customerSubTypes'
  | 'vendorServiceBranches'
  | 'locations'
  | 'workGroups'
  | 'claimSubjects'
  | 'documentTypes'
  | 'hrLeaveTypes';

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
  href: string;
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
    description: 'Operasyon birimleri ve ilişki sözlükleri.',
    items: [
      {
        key: 'departments',
    title: 'Departmanlar',
        purpose: 'Operasyon birimleri ve rapor formatları.',
        href: '/panel/ayarlar/departmanlar',
        tone: 'blue',
      },
      {
        key: 'relationshipTypes',
        title: 'İlişki Türleri',
        purpose: 'Müşteri, eksper ve tedarikçi ilişki türleri.',
        href: '/panel/ayarlar/iliski-turleri',
        tone: 'blue',
      },
      {
        key: 'customerSubTypes',
    title: 'Müşteri Tipleri',
        purpose: 'Müşteri kartında önce seçilen alt tip sözlüğü (sigorta, broker, eksper, asistans…).',
        href: '/panel/ayarlar/musteri-tipleri',
        tone: 'blue',
      },
      {
        key: 'hrLeaveTypes',
        title: 'Personel',
        purpose: 'İzin türleri; izin evrağı ve vekalet seçiminde kullanılır.',
        href: '/panel/ayarlar/personel',
        tone: 'amber',
      },
    ],
  },
  {
    title: 'Operasyonel Tanımlar',
    description: 'Saha ve hizmet sözlükleri.',
    items: [
      {
        key: 'vendorServiceBranches',
        title: 'Tedarikçi Hizmet Kolları',
        purpose: 'Tedarikçi kartında seçilen uzmanlık alanları (sıvacı, çilingir vb.).',
        href: '/panel/ayarlar/tedarikci-hizmet-kollari',
        tone: 'emerald',
      },
      {
        key: 'locations',
        title: 'Mahal ve Bölgeler',
        purpose: 'Rapor mahal ve alt bölge tanımları.',
        href: '/panel/ayarlar/mahaller',
        tone: 'emerald',
      },
      {
        key: 'workGroups',
        title: 'İş Grupları',
        purpose: 'Maliyet kalemleri + tedarikçi hasar hizmet kolları (Sıva, Boya, Mobilya…).',
        href: '/panel/ayarlar/is-gruplari',
        tone: 'amber',
      },
    ],
  },
  {
    title: 'Dosya Yaşam Döngüsü',
    description: 'Dosya açılışı ve evrak tanımları.',
    items: [
      {
        key: 'claimSubjects',
        title: 'Dosya Konuları',
        purpose: 'Departman bazlı dosya konuları; hasar/acil branş listeleri ve ihbar konuları bu ekrandan yönetilir.',
        href: '/panel/ayarlar/dosya-konulari',
        tone: 'violet',
      },
      {
        key: 'documentTypes',
        title: 'Evrak Türleri',
        purpose: 'Hizmet türüne bağlı evrak katalogları.',
        href: '/panel/ayarlar/evrak-turleri',
        tone: 'violet',
      },
    ],
  },
];

const TONE_CLASS: Record<DashboardItem['tone'], string> = {
  blue: 'border-blue-200 bg-blue-50 text-blue-700',
  emerald: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  amber: 'border-amber-200 bg-amber-50 text-amber-700',
  violet: 'border-violet-200 bg-violet-50 text-violet-700',
};

function extractArray(raw: unknown): unknown[] {
  if (Array.isArray(raw)) return raw;
  if (raw && typeof raw === 'object') {
    const obj = raw as Record<string, unknown>;
    if (Array.isArray(obj.data)) return obj.data;
    if (Array.isArray(obj.values)) return obj.values;
    if (Array.isArray(obj.types)) return obj.types;
    if (Array.isArray(obj.items)) return obj.items;
  }
  return [];
}

function countActive(items: unknown[]) {
  return items.filter((item) => {
    if (!item || typeof item !== 'object') return false;
    const row = item as Record<string, unknown>;
    return row.status === 'active' || row.isActive === true || row.active === true;
  }).length;
}

async function safeMetric(
  request: Promise<{ data: unknown }>,
  map: (raw: unknown) => Omit<DefinitionMetric, 'loading'>,
): Promise<DefinitionMetric> {
  try {
    return { ...map((await request).data), loading: false };
  } catch {
    return { total: null, active: null, loading: false, note: 'Okunamadı' };
  }
}

function DefinitionCard({ item, metric }: { item: DashboardItem; metric: DefinitionMetric }) {
  const countText = metric.loading ? '...' : metric.total ?? '-';
  const activeText = metric.loading || metric.active === null ? null : `${metric.active} aktif`;

  return (
    <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-blue-200 hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
                <div>
          <h3 className="text-sm font-semibold text-slate-900">{item.title}</h3>
          <p className="mt-1 text-xs leading-5 text-slate-500">{item.purpose}</p>
                </div>
        <span className={`shrink-0 rounded-lg border px-2 py-1 text-xs font-semibold ${TONE_CLASS[item.tone]}`}>
          {countText}
                </span>
              </div>
      {activeText ? <p className="mt-2 text-xs text-slate-400">{activeText}</p> : null}
      {metric.note ? <p className="mt-1 text-xs text-slate-400">{metric.note}</p> : null}
      <Link
        href={item.href}
        className="mt-4 inline-flex items-center rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
      >
        Yönetim ekranına git
      </Link>
    </article>
  );
}

export default function TanimlarPage() {
  const [metrics, setMetrics] = useState<Record<MetricKey, DefinitionMetric>>({
    departments: emptyMetric(),
    relationshipTypes: emptyMetric(),
    customerSubTypes: emptyMetric(),
    vendorServiceBranches: emptyMetric(),
    locations: emptyMetric(),
    workGroups: emptyMetric(),
    claimSubjects: emptyMetric(),
    documentTypes: emptyMetric(),
    hrLeaveTypes: emptyMetric(),
  });

  useEffect(() => {
    let alive = true;

    async function loadMetrics() {
      const headers = authHeader();
      const [
        departments,
        relationshipTypes,
        customerSubTypes,
        vendorServiceBranches,
        locations,
        workGroups,
        claimSubjects,
        documentTypes,
        hrLeaveTypes,
      ] = await Promise.all([
        safeMetric(axios.get(`${API}/departments`, { headers }), (raw) => {
          const items = extractArray(raw);
          return { total: items.length, active: countActive(items) };
        }),
        safeMetric(axios.get(`${API}/system-settings/relationship-types`, { headers }), (raw) => {
          const items = extractArray(raw);
          return { total: items.length, active: countActive(items) };
        }),
        safeMetric(axios.get(`${API}/system-settings/customer-sub-types`, { headers }), (raw) => {
          const items = extractArray(raw);
          return { total: items.length, active: items.length };
        }),
        safeMetric(axios.get(`${API}/service-branches/admin`, { headers, params: { scope: 'vendor', type: 'acil_yardim' } }), (raw) => {
          const items = extractArray(raw);
          return { total: items.length, active: countActive(items) };
        }),
        safeMetric(axios.get(`${API}/claim-locations`, { headers }), (raw) => {
          const items = extractArray(raw);
          const childCount = items.reduce((sum: number, item) => {
            if (!item || typeof item !== 'object') return sum;
            const subs = (item as Record<string, unknown>).subLocations;
            return sum + (Array.isArray(subs) ? subs.length : 0);
          }, 0);
          return { total: items.length + childCount, active: countActive(items) };
        }),
        safeMetric(axios.get(`${API}/work-groups`, { headers }), (raw) => {
          const items = extractArray(raw);
          return { total: items.length, active: countActive(items) };
        }),
        (async () => {
          try {
            const deptRes = await axios.get(`${API}/departments`, { headers });
            const depts = extractArray(deptRes.data) as Array<{ id?: string }>;
            let total = 0;
            await Promise.all(depts.map(async (dept) => {
              if (!dept.id) return;
              try {
                const res = await axios.get(`${API}/departments/${dept.id}/file-subjects`, { headers });
                total += extractArray(res.data).length;
              } catch { /* skip */ }
            }));
            return { total, active: null, loading: false };
          } catch {
            return { total: null, active: null, loading: false, note: 'Okunamadı' };
          }
        })(),
        safeMetric(axios.get(`${API}/document-types`, { headers }), (raw) => {
          const items = extractArray(raw);
          return { total: items.length, active: countActive(items) };
        }),
        safeMetric(axios.get(`${API}/system-settings/hr-leave-types`, { headers }), (raw) => {
          const items = extractArray(raw);
          return { total: items.length, active: countActive(items) };
        }),
      ]);

      if (!alive) return;
      setMetrics({
        departments,
        relationshipTypes,
        customerSubTypes,
        vendorServiceBranches,
        locations,
        workGroups,
        claimSubjects,
        documentTypes,
        hrLeaveTypes,
      });
    }

    loadMetrics();
    return () => { alive = false; };
  }, []);

  return (
    <SettingsPageLayout
      title="Tanımlar Merkezi"
      description="Tanım ailelerinin durumunu gösterir. Kayıt girişi ilgili yönetim ekranlarında yapılır."
      backHref="/panel/ayarlar"
      backText="← Ayarlar"
    >
      <div className="space-y-6">
        {DASHBOARD_GROUPS.map((group) => (
          <section key={group.title} className="rounded-xl border border-slate-200 bg-slate-50/50 p-4">
            <div className="mb-4">
              <h2 className="text-base font-semibold text-slate-900">{group.title}</h2>
              <p className="mt-1 text-sm text-slate-500">{group.description}</p>
                </div>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {group.items.map((item) => (
                <DefinitionCard key={item.key} item={item} metric={metrics[item.key]} />
              ))}
            </div>
          </section>
        ))}
        <p className="text-xs text-slate-400">
          Cari kayıtlar sol menüdeki Müşteriler ekranından açılır; burada yalnızca tip ve sözlük tanımları yönetilir.
        </p>
            </div>
    </SettingsPageLayout>
  );
}
