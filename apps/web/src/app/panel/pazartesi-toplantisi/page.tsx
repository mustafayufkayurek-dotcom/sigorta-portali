'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, CalendarDays } from 'lucide-react';
import { usePanelAccess } from '@/hooks/usePanelAccess';
import { WeeklyPerformanceWidget } from '@/features/dashboard/components/admin';
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
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <Link
            href="/panel"
            className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800"
          >
            <ArrowLeft className="h-4 w-4" />
            Dashboard
          </Link>
          <div className="min-w-0">
            <h1 className="flex items-center gap-2 text-lg font-bold text-slate-900">
              <CalendarDays className="h-5 w-5 text-blue-600" />
              Pazartesi Toplantısı
            </h1>
            <p className="text-xs text-slate-500">Haftalık performans özeti ve toplantı notları</p>
          </div>
        </div>
      </div>

      <WeeklyPerformanceWidget staggerIndex={0} />

      <MondayMeetingNotes mode="page" />
    </div>
  );
}
