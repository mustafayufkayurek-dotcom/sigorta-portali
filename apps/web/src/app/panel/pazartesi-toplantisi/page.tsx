'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, CalendarDays } from 'lucide-react';
import { usePanelAccess } from '@/hooks/usePanelAccess';
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
          <Link
            href="/panel"
            className="mb-3 inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 transition-colors hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Dashboard
          </Link>

          <div className="flex min-w-0 items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-blue-50 dark:bg-blue-950/40">
              <CalendarDays className="h-5 w-5 text-blue-600" />
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
