'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

const OPEN_KEY = 'panel-help-drawer-open';
const WIDTH_KEY = 'panel-help-drawer-width';

export const HELP_DRAWER_MIN_WIDTH = 320;
export const HELP_DRAWER_MAX_WIDTH = 560;
export const HELP_DRAWER_DEFAULT_WIDTH = 380;

type PanelHelpDrawerContextValue = {
  open: boolean;
  width: number;
  setOpen: (open: boolean) => void;
  toggle: () => void;
  setWidth: (width: number) => void;
};

const PanelHelpDrawerContext = createContext<PanelHelpDrawerContextValue | null>(null);

function clampWidth(value: number) {
  return Math.min(HELP_DRAWER_MAX_WIDTH, Math.max(HELP_DRAWER_MIN_WIDTH, Math.round(value)));
}

export function PanelHelpDrawerProvider({ children }: { children: ReactNode }) {
  const [open, setOpenState] = useState(false);
  const [width, setWidthState] = useState(HELP_DRAWER_DEFAULT_WIDTH);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      setOpenState(localStorage.getItem(OPEN_KEY) === 'true');
      const storedWidth = Number(localStorage.getItem(WIDTH_KEY));
      if (Number.isFinite(storedWidth) && storedWidth > 0) {
        setWidthState(clampWidth(storedWidth));
      }
    } catch {
      /* localStorage yoksa varsayılan */
    }
    setHydrated(true);
  }, []);

  const setOpen = useCallback((next: boolean) => {
    setOpenState(next);
    try {
      localStorage.setItem(OPEN_KEY, String(next));
    } catch {
      /* sessiz */
    }
  }, []);

  const toggle = useCallback(() => {
    setOpenState((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(OPEN_KEY, String(next));
      } catch {
        /* sessiz */
      }
      return next;
    });
  }, []);

  const setWidth = useCallback((next: number) => {
    const clamped = clampWidth(next);
    setWidthState(clamped);
    try {
      localStorage.setItem(WIDTH_KEY, String(clamped));
    } catch {
      /* sessiz */
    }
  }, []);

  const value = useMemo(
    () => ({ open: hydrated ? open : false, width, setOpen, toggle, setWidth }),
    [hydrated, open, width, setOpen, toggle, setWidth],
  );

  return (
    <PanelHelpDrawerContext.Provider value={value}>
      {children}
    </PanelHelpDrawerContext.Provider>
  );
}

export function usePanelHelpDrawer() {
  const ctx = useContext(PanelHelpDrawerContext);
  if (!ctx) {
    throw new Error('usePanelHelpDrawer PanelHelpDrawerProvider içinde kullanılmalı');
  }
  return ctx;
}

/** Provider dışında güvenli no-op (navbar erişim reddi vb.) */
export function usePanelHelpDrawerOptional(): PanelHelpDrawerContextValue | null {
  return useContext(PanelHelpDrawerContext);
}
