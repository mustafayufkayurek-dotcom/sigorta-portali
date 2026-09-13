'use client';

import { useCallback, useEffect, useState } from 'react';
import { apiClient } from '@/lib/api-client';
import { AttendanceAccessGate } from './AttendanceAccessGate';

type SummaryGate = {
  mustConfirmOwnAttendance?: boolean;
  dayEndWarning?: {
    pending?: boolean;
    workDateLabel?: string;
  };
};

type Props = {
  enabled: boolean;
};

/**
 * Gün başı: personel önce bugünkü puantajı onaylar.
 * Modül kapalıysa sessizce durur.
 */
export function AttendancePanelGate({ enabled }: Props) {
  const [pending, setPending] = useState(false);
  const [workDateLabel, setWorkDateLabel] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    if (!enabled) return;
    apiClient
      .get<SummaryGate>('hr/summary')
      .then((data) => {
        const must = Boolean(data?.mustConfirmOwnAttendance);
        const isPending = Boolean(data?.dayEndWarning?.pending);
        setWorkDateLabel(data?.dayEndWarning?.workDateLabel ?? '');
        setPending(must && isPending);
      })
      .catch(() => {
        setPending(false);
      });
  }, [enabled]);

  useEffect(() => {
    load();
  }, [load]);

  const confirmToday = useCallback(() => {
    const now = new Date();
    setSaving(true);
    apiClient
      .post('hr/attendance/confirm-pending', {
        year: now.getFullYear(),
        month: now.getMonth() + 1,
      })
      .then(() => setPending(false))
      .catch(() => {
        /* kapı açık kalır */
      })
      .finally(() => setSaving(false));
  }, []);

  if (!enabled || !pending) return null;

  return (
    <div className="fixed inset-0 z-[76] flex items-center justify-center bg-slate-100/90 p-4 dark:bg-slate-950/90">
      <div className="w-full max-w-lg">
        <AttendanceAccessGate
          mode="blocked"
          workDateLabel={workDateLabel || undefined}
          onConfirmAttendance={saving ? undefined : confirmToday}
        />
      </div>
    </div>
  );
}
