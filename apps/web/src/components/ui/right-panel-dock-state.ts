import { useEffect, useState } from 'react';

/** Soldaki sayfaya tıklayınca sağ panel kapanmaz; sağa kayar. İşlem durur. */
export function useRightPanelDock(open: boolean) {
  const [docked, setDocked] = useState(false);

  useEffect(() => {
    if (!open) setDocked(false);
  }, [open]);

  return {
    docked: open && docked,
    dock: () => {
      if (open) setDocked(true);
    },
    expand: () => setDocked(false),
  };
}

export function rightPanelDockClass(open: boolean, docked: boolean): string {
  if (!open) return 'translate-x-full pointer-events-none';
  if (docked) return 'translate-x-full overflow-hidden pointer-events-none';
  return 'translate-x-0';
}

/** Kaydırılmış panel unutulmasın diye hatırlatma (ms). */
export const RIGHT_PANEL_DOCK_REMIND_MS = 20_000;
