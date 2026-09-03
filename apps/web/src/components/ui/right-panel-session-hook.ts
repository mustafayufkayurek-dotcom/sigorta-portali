'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import {
  currentPanelHref,
  hrefMatchesSession,
  patchRightPanelSession,
  readRightPanelSession,
  type RightPanelRestore,
} from './right-panel-session';

export function useRestoreRightPanelSession(
  kind: string,
  apply: (restore: RightPanelRestore) => void,
) {
  const pathname = usePathname();

  useEffect(() => {
    const session = readRightPanelSession();
    if (!session?.restore || session.restore.kind !== kind) return;
    if (!hrefMatchesSession(session.href, currentPanelHref(pathname))) return;
    apply(session.restore);
    if (session.docked) {
      patchRightPanelSession({ docked: false });
    }
    // İlk dönüşte bir kez uygula
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind, pathname]);
}
