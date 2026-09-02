'use client';

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type RefObject,
} from 'react';
import { useNavigationGuardOptional } from '@/contexts/NavigationGuardContext';

export const RIGHT_PANEL_GUARD_ID = 'right-panel';

export const RIGHT_PANEL_UNSAVED_MESSAGE =
  'Sağ panelde kaydedilmemiş işlem var. Kaydetmeden çıkarsanız yazdıklarınız silinir';

export function usePanelDirty(enabled: boolean, containerRef: RefObject<HTMLElement | null>) {
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (!enabled) {
      setDirty(false);
      return;
    }
    const el = containerRef.current;
    if (!el) return;
    const mark = () => setDirty(true);
    el.addEventListener('input', mark);
    el.addEventListener('change', mark);
    return () => {
      el.removeEventListener('input', mark);
      el.removeEventListener('change', mark);
    };
  }, [enabled, containerRef]);

  const markClean = useCallback(() => setDirty(false), []);
  const markDirty = useCallback(() => setDirty(true), []);
  return { dirty, markClean, markDirty };
}

/** Gizlenmiş veya açık sağ panelde yazı varken X / çıkış kaydet hatırlatması. */
export function useRightPanelUnsavedGuard({
  open,
  expand,
  close,
  onSave,
  panelRef,
}: {
  open: boolean;
  expand: () => void;
  close: () => void;
  onSave?: () => void | Promise<void>;
  panelRef: RefObject<HTMLElement | null>;
}) {
  const { dirty, markClean } = usePanelDirty(open, panelRef);
  const nav = useNavigationGuardOptional();
  const expandRef = useRef(expand);
  expandRef.current = expand;
  const closeRef = useRef(close);
  closeRef.current = close;
  const saveRef = useRef(onSave);
  saveRef.current = onSave;
  const dirtyRef = useRef(dirty);
  dirtyRef.current = dirty;

  useEffect(() => {
    if (!nav) return;
    if (!open || !dirty) {
      nav.registerGuard(null, RIGHT_PANEL_GUARD_ID);
      return;
    }
    nav.registerGuard(
      {
        hasUnsaved: () => dirtyRef.current,
        message: RIGHT_PANEL_UNSAVED_MESSAGE,
        onSave: saveRef.current
          ? async () => {
              expandRef.current();
              await saveRef.current?.();
              markClean();
            }
          : undefined,
        onDiscard: () => {
          markClean();
        },
        onContinue: () => {
          expandRef.current();
        },
      },
      RIGHT_PANEL_GUARD_ID,
    );
    return () => nav.registerGuard(null, RIGHT_PANEL_GUARD_ID);
  }, [nav, open, dirty, markClean]);

  const requestClose = useCallback(() => {
    if (!dirty || !nav) {
      closeRef.current();
      return;
    }
    nav.tryNavigate(() => {
      markClean();
      closeRef.current();
    }, 'leave');
  }, [dirty, nav, markClean]);

  return { requestClose, dirty, markClean };
}
