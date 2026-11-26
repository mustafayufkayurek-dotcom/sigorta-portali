'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { usePathname, useRouter } from 'next/navigation';
import axios from 'axios';
import {
  HASAR_TESPIT_ARAC_KURULUM_ETIKET,
  hasarTespitAracKurulumHref,
  type HasarTespitAracKurulumAdim,
} from '@sigorta/shared';
import { FinansActionButton, FinansModal } from '@/components/finance/FinansPanelUI';
import { RightPanelDockTab } from '@/components/ui/right-panel-dock';
import { useNavigationGuardOptional } from '@/contexts/NavigationGuardContext';
import { API, authHeader, getToken } from '@/utils/api';

/** Araç sayfası kaydınca yayınlanır — UI oturum yazımından ayrı. */
export const HASAR_TESPIT_ARAC_KAYDEDILDI = 'hasar-tespit-arac-kaydedildi';

const UI_KEY = 'hasar-tespit-arac-kurulum-ui';
const GUARD_ID = 'hasar-tespit-arac-kurulum';
/** Panel şeridinin altında — iki şerit üst üste binmesin */
const KURULUM_DOCK_POSITION = 'top-[68%] -translate-y-1/2';

type UiMode = 'hidden' | 'modal' | 'docked';

type StoredUi = {
  mode: UiMode;
  steps: HasarTespitAracKurulumAdim[];
  focus: HasarTespitAracKurulumAdim | null;
};

type Props = {
  enabled: boolean;
  userId: string | null | undefined;
  roleCode: string | null | undefined;
};

function readStored(): StoredUi | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(UI_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredUi;
    if (!parsed || !Array.isArray(parsed.steps)) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeStored(next: StoredUi | null) {
  if (typeof window === 'undefined') return;
  if (!next || next.steps.length === 0 || next.mode === 'hidden') {
    sessionStorage.removeItem(UI_KEY);
  } else {
    sessionStorage.setItem(UI_KEY, JSON.stringify(next));
  }
}

function onKurulumPage(pathname: string | null | undefined): boolean {
  return Boolean(pathname?.startsWith('/panel/ayarlar/hasar-tespit-arac'));
}

function scrollToKurulumHash(href: string) {
  const hash = href.includes('#') ? href.split('#')[1] : '';
  if (!hash || typeof document === 'undefined') return;
  const run = () => {
    document.getElementById(hash)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };
  window.setTimeout(run, 80);
  window.setTimeout(run, 320);
}

/**
 * Girişte eksik kurulum listesi (Sayfaya Git).
 * Dışarı tıklayınca sağ kenar şeridi (Panel yöntemi). Şeride tıklayınca liste açılır.
 * Çıkış: kurulum bitmeden engellenir.
 */
export function HasarTespitAracKurulumWizard({ enabled, userId, roleCode }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const navGuard = useNavigationGuardOptional();
  const [mode, setMode] = useState<UiMode>('hidden');
  const [steps, setSteps] = useState<HasarTespitAracKurulumAdim[]>([]);
  const [focus, setFocus] = useState<HasarTespitAracKurulumAdim | null>(null);
  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState('');
  const modeRef = useRef<UiMode>('hidden');
  const stepsRef = useRef<HasarTespitAracKurulumAdim[]>([]);
  const focusRef = useRef<HasarTespitAracKurulumAdim | null>(null);

  const applyState = useCallback((next: StoredUi) => {
    modeRef.current = next.mode;
    stepsRef.current = next.steps;
    focusRef.current = next.focus;
    setMode(next.mode);
    setSteps(next.steps);
    setFocus(next.focus);
    writeStored(next.mode === 'hidden' ? null : next);
  }, []);

  const openList = useCallback(() => {
    const current = stepsRef.current;
    if (current.length === 0) return;
    applyState({
      mode: 'modal',
      steps: current,
      focus: focusRef.current && current.includes(focusRef.current)
        ? focusRef.current
        : current[0] ?? null,
    });
  }, [applyState]);

  const refresh = useCallback(async (opts?: { forceModal?: boolean }) => {
    if (!enabled) return;
    if (!getToken()) {
      setReady(true);
      return;
    }
    try {
      const res = await axios.get(`${API}/hasar-tespit-bedel/arac-kurulum`, {
        headers: authHeader(),
        withCredentials: true,
      });
      const data = res.data?.data ?? {};
      const serverShow = Boolean(data.show);
      const nextSteps: HasarTespitAracKurulumAdim[] =
        serverShow && Array.isArray(data.steps)
          ? (data.steps as HasarTespitAracKurulumAdim[])
          : [];

      setLoadError('');
      if (nextSteps.length === 0) {
        applyState({ mode: 'hidden', steps: [], focus: null });
        return;
      }

      const stored = readStored();
      const onPage = onKurulumPage(
        typeof window !== 'undefined' ? window.location.pathname : null,
      );
      let nextMode: UiMode = 'modal';
      if (onPage) nextMode = 'docked';
      else if (opts?.forceModal) nextMode = 'modal';
      else if (modeRef.current === 'docked' || stored?.mode === 'docked') nextMode = 'docked';
      else nextMode = 'modal';

      const nextFocus =
        (stored?.focus && nextSteps.includes(stored.focus) ? stored.focus : null)
        ?? nextSteps[0]
        ?? null;

      applyState({ mode: nextMode, steps: nextSteps, focus: nextFocus });
    } catch (e: unknown) {
      const msg = axios.isAxiosError(e)
        ? String(e.response?.data?.message ?? e.message ?? 'Kurulum durumu okunamadı')
        : 'Kurulum durumu okunamadı';
      setLoadError(Array.isArray(msg) ? String(msg[0]) : msg);
    } finally {
      setReady(true);
    }
  }, [applyState, enabled]);

  const bootKeyRef = useRef('');
  const pathnameSnap = useRef(pathname);
  pathnameSnap.current = pathname;

  useEffect(() => {
    if (!enabled) {
      bootKeyRef.current = '';
      applyState({ mode: 'hidden', steps: [], focus: null });
      return;
    }
    if (!roleCode && !userId) return;
    const bootKey = `${String(userId ?? '')}|${String(roleCode ?? '')}`;
    const isFreshEntry = bootKeyRef.current !== bootKey;
    bootKeyRef.current = bootKey;
    const onPage = onKurulumPage(pathnameSnap.current);
    void refresh({ forceModal: isFreshEntry && !onPage });
  }, [enabled, roleCode, userId, refresh, applyState]);

  useEffect(() => {
    if (!enabled || !ready || steps.length > 0 || loadError) return;
    if (!getToken()) return;
    const t = window.setTimeout(() => {
      void refresh({ forceModal: !onKurulumPage(pathnameSnap.current) });
    }, 400);
    return () => window.clearTimeout(t);
  }, [enabled, ready, steps.length, loadError, refresh]);

  // Yol değişince: hedef sayfada çekmece; dışarıda liste modalı
  useEffect(() => {
    if (!enabled || !ready) return;
    const currentSteps = stepsRef.current;
    if (currentSteps.length === 0) return;
    const nextFocus =
      (focusRef.current && currentSteps.includes(focusRef.current) ? focusRef.current : null)
      ?? currentSteps[0]
      ?? null;
    if (onKurulumPage(pathname)) {
      applyState({ mode: 'docked', steps: currentSteps, focus: nextFocus });
      return;
    }
    if (modeRef.current === 'docked') {
      // Sayfaya Git sonrası henüz pathname güncellenmeden kısa an — modal zorlama
      return;
    }
    applyState({ mode: 'modal', steps: currentSteps, focus: nextFocus });
  }, [pathname, enabled, ready, applyState]);

  useEffect(() => {
    const onSaved = () => {
      void refresh();
    };
    window.addEventListener(HASAR_TESPIT_ARAC_KAYDEDILDI, onSaved);
    return () => window.removeEventListener(HASAR_TESPIT_ARAC_KAYDEDILDI, onSaved);
  }, [refresh]);

  useEffect(() => {
    if (!navGuard) return;
    if (!enabled || steps.length === 0) {
      navGuard.registerGuard(null, GUARD_ID);
      return;
    }
    navGuard.registerGuard(
      {
        hasUnsaved: () => stepsRef.current.length > 0,
        logoutOnly: true,
        forbidExit: true,
        message:
          'Kurulum işlemlerini tamamlayın. Eksik adımlar bitmeden yazılımdan çıkılamaz.',
        onContinue: () => {
          openList();
        },
      },
      GUARD_ID,
    );
    return () => navGuard.registerGuard(null, GUARD_ID);
  }, [navGuard, enabled, steps.length, openList]);

  useEffect(() => {
    if (!enabled || steps.length === 0) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [enabled, steps.length]);

  const goStep = (adim: HasarTespitAracKurulumAdim) => {
    const href = hasarTespitAracKurulumHref(adim);
    applyState({ mode: 'docked', steps: stepsRef.current.length ? stepsRef.current : steps, focus: adim });
    router.push(href);
    scrollToKurulumHash(href);
  };

  if (!ready) return null;

  if (mode === 'hidden' || steps.length === 0) {
    if (!loadError) return null;
    return createPortal(
      <div
        className="fixed inset-x-0 bottom-0 z-[420] border-t border-red-200 bg-red-50 px-3 py-2 text-center text-xs text-red-800"
        data-testid="hasar-tespit-arac-kurulum-hata"
      >
        Kurulum penceresi açılamadı: {loadError}
        {' '}
        <button
          type="button"
          className="font-semibold underline"
          onClick={() => void refresh({ forceModal: true })}
        >
          Tekrar Dene
        </button>
      </div>,
      document.body,
    );
  }

  // Modal açıkken şerit gizlenir; dışarı tıklayınca sağ şerit (Panel yöntemi)
  const showModal = mode === 'modal';
  const showDock = !showModal && (onKurulumPage(pathname) || mode === 'docked');

  const focusStep = focus && steps.includes(focus) ? focus : steps[0];

  return (
    <>
      {showModal ? (
        <FinansModal
          open
          title="Eksik Kurulum"
          subtitle="İlgili sayfaya gidin. Dışarı tıklayınca sağdaki şeride iner. Adımlar bitince şerit kalkar."
          size="md"
          testId="hasar-tespit-arac-kurulum-wizard"
          onBackdropClose={() => {
            applyState({
              mode: 'docked',
              steps,
              focus: focusStep,
            });
          }}
        >
          <div className="space-y-3" data-testid="hasar-tespit-arac-kurulum-adim">
            <p className="text-xs text-slate-500">
              {steps.length} eksik adım. Her satır ilgili ayar sayfasına gider.
            </p>
            <ol className="space-y-2">
              {steps.map((adim, idx) => (
                <li
                  key={adim}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50/80 px-3 py-2.5"
                >
                  <div className="min-w-0">
                    <p className="text-[11px] font-medium text-slate-400">Adım {idx + 1}</p>
                    <p className="text-sm font-semibold text-slate-900">
                      {HASAR_TESPIT_ARAC_KURULUM_ETIKET[adim]}
                    </p>
                  </div>
                  <FinansActionButton
                    label="Sayfaya Git"
                    variant="primary"
                    showPlus={false}
                    onClick={() => goStep(adim)}
                    testId={`hasar-tespit-arac-kurulum-git-${adim}`}
                  />
                </li>
              ))}
            </ol>
          </div>
        </FinansModal>
      ) : null}

      {showDock ? (
        <div data-testid="hasar-tespit-arac-kurulum-cekmece">
          <RightPanelDockTab
            label="Kurulum"
            tone="amber"
            remindEnabled={false}
            positionClass={KURULUM_DOCK_POSITION}
            testId="hasar-tespit-arac-kurulum-cekmece-ac"
            onClick={openList}
          />
        </div>
      ) : null}
    </>
  );
}
