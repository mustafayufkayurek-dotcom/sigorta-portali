'use client';

import { useCallback, useEffect, useImperativeHandle, useRef, useState, forwardRef } from 'react';
import { apiClient } from '@/lib/api-client';
import { API } from '@/utils/api';
import { logoutAndRedirect } from '@/utils/auth-session';
import { WorkHoursNoticeModal, type WorkHoursNoticeMode } from './WorkHoursNoticeModal';

type PanelAccessData = {
  subjectToGate: boolean;
  canEnter: boolean;
  notice: 'none' | 'late_entry' | 'closed';
  clockLabel: string;
  dateKey: string;
  workDateLabel: string;
  expectedStart: string | null;
  expectedEnd: string | null;
  closedReasonLabel: string | null;
  holidayName: string | null;
  earlyExit: {
    show: boolean;
    clockLabel: string;
    expectedEnd: string | null;
  };
};

export type WorkHoursPanelGateHandle = {
  beforeLogout: (proceed: () => void) => void;
};

type Props = {
  enabled: boolean;
};

function lateEntryStorageKey(dateKey: string) {
  return `wh-late-entry-ack:${dateKey}`;
}

export const WorkHoursPanelGate = forwardRef<WorkHoursPanelGateHandle, Props>(
  function WorkHoursPanelGate({ enabled }, ref) {
    const [access, setAccess] = useState<PanelAccessData | null>(null);
    const [mode, setMode] = useState<WorkHoursNoticeMode | null>(null);
    const [open, setOpen] = useState(false);
    const pendingLogoutRef = useRef<(() => void) | null>(null);
    const loadedRef = useRef(false);

    useEffect(() => {
      if (!enabled) return;
      let alive = true;
      apiClient
        .get<PanelAccessData>('hr/panel-access')
        .then((data) => {
          if (!alive) return;
          setAccess(data);
          loadedRef.current = true;

          if (!data.subjectToGate) return;

          if (!data.canEnter || data.notice === 'closed') {
            setMode('closed');
            setOpen(true);
            return;
          }

          if (data.notice === 'late_entry') {
            try {
              if (sessionStorage.getItem(lateEntryStorageKey(data.dateKey)) === '1') return;
            } catch {
              /* ignore */
            }
            setMode('late_entry');
            setOpen(true);
          }
        })
        .catch(() => {
          /* Modül kapalı / yetki yok → kapı uygulanmaz */
        });
      return () => {
        alive = false;
      };
    }, [enabled]);

    const closeSoft = useCallback(() => {
      if (mode === 'late_entry' && access?.dateKey) {
        try {
          sessionStorage.setItem(lateEntryStorageKey(access.dateKey), '1');
        } catch {
          /* ignore */
        }
      }
      if (mode === 'early_exit') {
        const proceed = pendingLogoutRef.current;
        pendingLogoutRef.current = null;
        setOpen(false);
        setMode(null);
        proceed?.();
        return;
      }
      setOpen(false);
      if (mode !== 'closed') setMode(null);
    }, [access?.dateKey, mode]);

    const handleClosedAck = useCallback(() => {
      void logoutAndRedirect(API, (url) => {
        window.location.href = url;
      }, 'logout');
    }, []);

    useImperativeHandle(
      ref,
      () => ({
        beforeLogout: (proceed: () => void) => {
          if (!enabled || !access?.subjectToGate || !access.earlyExit?.show) {
            proceed();
            return;
          }
          pendingLogoutRef.current = proceed;
          setMode('early_exit');
          setOpen(true);
        },
      }),
      [access, enabled],
    );

    if (!enabled || !open || !mode || !access) return null;

    const expectedLabel =
      mode === 'late_entry' && access.expectedStart
        ? `Beklenen mesai başlangıcı: ${access.expectedStart}`
        : mode === 'early_exit' && (access.earlyExit.expectedEnd || access.expectedEnd)
          ? `Beklenen mesai bitişi: ${access.earlyExit.expectedEnd ?? access.expectedEnd}`
          : mode === 'closed' && access.expectedStart && access.expectedEnd
            ? `Mesai: ${access.expectedStart} – ${access.expectedEnd}`
            : mode === 'closed' && access.holidayName
              ? `Resmi tatil: ${access.holidayName}`
              : undefined;

    const clockLabel =
      mode === 'early_exit' ? access.earlyExit.clockLabel : access.clockLabel;

    return (
      <>
        {mode === 'closed' ? (
          <div className="fixed inset-0 z-[75] bg-slate-100/90 dark:bg-slate-950/90" />
        ) : null}
        <WorkHoursNoticeModal
          open={open}
          mode={mode}
          clockLabel={clockLabel}
          workDateLabel={access.workDateLabel}
          expectedLabel={expectedLabel}
          closedReasonLabel={access.closedReasonLabel ?? undefined}
          onContinue={closeSoft}
          onClose={mode === 'closed' ? handleClosedAck : closeSoft}
        />
      </>
    );
  },
);
