'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, CalendarDays } from 'lucide-react';
import { usePanelAccess } from '@/hooks/usePanelAccess';
import { PanelFlowTrail } from '@/components/ui/PanelFlowTrail';
import { MondayMeetingNotes } from '@/features/dashboard/components/admin/monday-meeting-notes';

export default function PazartesiToplantisiPage() {
  const router = useRouter();
  const { isManagement } = usePanelAccess();

  useEffect(() => {
    if (!isManagement) {
      router.replace('/panel');
    }
  }, [isManagement, router]);

  if (!isManagement) {
    return null;
  }

  return (
    <div className="space-y-4 pb-8">
      <div className="overflow-hidden rounded-2xl border border-slate-200/70 bg-white shadow-card dark:border-slate-700 dark:bg-slate-900">
        <div className="px-4 py-4 sm:px-6 sm:py-5">
          <div className="mb-3 flex items-center gap-2">
            <Link
              href="/panel"
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
              aria-label="Geri"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
            </Link>
            <PanelFlowTrail
              items={[
                { label: 'Dashboard', href: '/panel' },
                { label: 'Pazartesi Toplantısı' },
              ]}
            />
          </div>

          <div className="flex min-w-0 items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-blue-50 dark:bg-blue-950/40">
              <CalendarDays className="h-5 w-5 text-brand-600" />
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="text-xl font-bold tracking-tight text-slate-950 dark:text-white sm:text-2xl">
                Pazartesi Toplantısı
              </h1>
              <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
                Haftalık toplantı gündemi ve notları
              </p>
            </div>
          </div>
        </div>
      </div>

      <MondayMeetingNotes mode="page" showBriefing />
    </div>
  );
}
