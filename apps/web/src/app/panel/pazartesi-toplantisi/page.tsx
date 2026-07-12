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
    <div className="space-y-3 pb-4">
      <div className="flex flex-wrap items-center gap-2">
        <Link
          href="/panel"
          className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-800"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Dashboard
        </Link>
        <span className="text-slate-300">/</span>
        <h1 className="flex items-center gap-1.5 text-base font-bold text-slate-900">
          <CalendarDays className="h-4 w-4 text-blue-600" />
          Pazartesi Toplantısı
        </h1>
        <span className="hidden sm:inline text-xs text-slate-400">
          Haftalık toplantı gündemi ve notları
        </span>
      </div>

      <MondayMeetingNotes mode="page" />
    </div>
  );
}
