'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { RightPanelDockTab } from './right-panel-dock';
import {
  RIGHT_PANEL_SESSION_EVENT,
  currentPanelHref,
  hrefMatchesSession,
  patchRightPanelSession,
  readRightPanelSession,
  type RightPanelSession,
} from './right-panel-session';

/** Sayfa değişince kaydırılmış sağ panel şeridi kaybolmasın. */
export function RightPanelDockHost() {
  const pathname = usePathname();
  const router = useRouter();
  const [session, setSession] = useState<RightPanelSession | null>(null);

  useEffect(() => {
    const sync = () => setSession(readRightPanelSession());
    sync();
    window.addEventListener(RIGHT_PANEL_SESSION_EVENT, sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener(RIGHT_PANEL_SESSION_EVENT, sync);
      window.removeEventListener('storage', sync);
    };
  }, []);

  if (!session?.docked) return null;
  if (hrefMatchesSession(session.href, currentPanelHref(pathname))) return null;

  return (
    <RightPanelDockTab
      label={session.title || 'Panel'}
      onClick={() => {
        patchRightPanelSession({ docked: false });
        router.push(session.href);
      }}
    />
  );
}
