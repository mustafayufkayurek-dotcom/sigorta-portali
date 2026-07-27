'use client';

import Link from 'next/link';
import {
  BarChart3,
  Building2,
  ClipboardList,
  Clock3,
  PieChart,
  Users,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { usePanelRoleCode, isFinanceRole } from '@/hooks/usePanelRole';

type ReportLink = {
  title: string;
  description: string;
  href: string;
  icon: LucideIcon;
  /** Boşsa tüm roller görür */
  roles?: string[];
};

const REPORT_LINKS: ReportLink[] = [
  {
    title: 'Finansal Rapor',
    description: 'Gelir-gider özeti, tahsilat trendi ve kârlılık tabloları.',
    href: '/panel/raporlar/finansal',
    icon: BarChart3,
  },
  {
    title: 'SLA Raporu',
    description: 'Departman uyumu, ihlal edilen dosyalar ve SLA kuralları.',
    href: '/panel/raporlar/sla',
    icon: Clock3,
  },
  {
    title: 'Dosya Performans Raporu',
    description: 'Departman ve sigorta şirketi bazında dosya kapanış performansı.',
    href: '/panel/raporlar/dosya-performansi',
    icon: ClipboardList,
    roles: ['admin', 'manager', 'office_staff'],
  },
  {
    title: 'Branş Analizi',
    description: 'Branş dağılımı, trend ve sigorta şirketi kırılımı.',
    href: '/panel/raporlar/brans-analizi',
    icon: PieChart,
  },
  {
    title: 'Personel Performans Raporu',
    description: 'Dosya sorumlusu ve ekip bazında iş yükü ve kapanış metrikleri.',
    href: '/panel/raporlar/personel-performansi',
    icon: Users,
    roles: ['admin', 'manager'],
  },
  {
    title: 'Eksper Performans Raporu',
    description: 'Eksper atama, rapor süresi ve revizyon oranları.',
    href: '/panel/raporlar/eksper',
    icon: Building2,
    roles: ['admin', 'manager', 'office_staff'],
  },
];

function canSeeReport(roleCode: string, link: ReportLink): boolean {
  if (!link.roles?.length) return true;
  const code = roleCode.trim().toLowerCase();
  if (isFinanceRole(code) && link.roles.some((r) => ['finance', 'finans', 'accountant'].includes(r))) {
    return true;
  }
  return link.roles.some((r) => r === code || r === code.replace(/-/g, '_'));
}

export default function RaporlarHubPage() {
  const roleCode = usePanelRoleCode();
  const visibleLinks = REPORT_LINKS.filter((link) => canSeeReport(roleCode, link));

  return (
    <div className="min-w-0 space-y-6">
      <section className="space-y-2 border-b border-slate-200 pb-6 dark:border-slate-800">
        <p className="text-xs font-semibold text-brand-600">Analiz Merkezi</p>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Raporlar</h1>
        <p className="max-w-3xl text-sm text-slate-600 dark:text-slate-400">
          Finans, operasyon ve performans raporlarına buradan ulaşın. İlgili karta tıklayarak detaylı raporu açın.
        </p>
      </section>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {visibleLinks.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className="group min-h-[132px] rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-md dark:border-slate-800 dark:bg-slate-900 dark:hover:border-blue-500/40"
            >
              <div className="flex items-start gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-brand-600 group-hover:bg-brand-600 group-hover:text-white dark:bg-blue-500/10">
                  <Icon className="h-5 w-5" />
                </span>
                <div className="min-w-0">
                  <h2 className="text-sm font-semibold text-slate-900 dark:text-white">{item.title}</h2>
                  <p className="mt-1 text-sm leading-5 text-slate-500 dark:text-slate-400">{item.description}</p>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
