'use client';

import { useCallback, useEffect, useState } from 'react';
import { apiClient } from '@/lib/api-client';
import { getApiErrorMessage } from '@/utils/api-error';
import { withUiActionTimeout, UI_ACTION_TIMEOUT_MESSAGE } from '@/utils/ui-action-timeout';
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
  const [saveError, setSaveError] = useState('');

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
    setSaveError('');
    withUiActionTimeout(
      apiClient.post('hr/attendance/confirm-pending', {
        year: now.getFullYear(),
        month: now.getMonth() + 1,
      }),
    )
      .then(() => setPending(false))
      .catch((err: unknown) => {
        setSaveError(getApiErrorMessage(err, UI_ACTION_TIMEOUT_MESSAGE));
      })
      .finally(() => setSaving(false));
  }, []);

  if (!enabled || !pending) return null;

  return (
    <div className="fixed inset-0 z-[76] flex items-end justify-center bg-slate-100/90 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] dark:bg-slate-950/90 sm:items-center">
      <div className="w-full max-w-lg">
        <AttendanceAccessGate
          mode="blocked"
          workDateLabel={workDateLabel || undefined}
          onConfirmAttendance={saving ? undefined : confirmToday}
        />
        {saveError ? (
          <p className="mt-3 text-center text-sm text-amber-800" data-testid="puantaj-islem-zaman-asimi">
            {saveError}
          </p>
        ) : null}
      </div>
    </div>
  );
}
