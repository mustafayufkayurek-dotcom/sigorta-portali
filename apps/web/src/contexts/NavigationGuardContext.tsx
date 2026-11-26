'use client';

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import SaveReminderModal, { type SaveReminderDetail } from '@/components/damage-reports/SaveReminderModal';

export type NavigationIntent = 'leave' | 'logout';

export type NavigationGuardRegistration = {
  hasUnsaved: () => boolean;
  detail?: SaveReminderDetail;
  saving?: boolean;
  message?: string;
  onSave?: () => void | Promise<void>;
  onDiscard?: () => void | Promise<void>;
  onContinue?: () => void;
  /** Yalnız çıkış / oturum kapatmada engelle; sayfa gezintisine dokunma */
  logoutOnly?: boolean;
  /** Çıkışı tamamen kes — «Kaydetmeden çık» yok */
  forbidExit?: boolean;
};

type TryNavigateFn = (proceed: () => void, intent?: NavigationIntent) => void;

type NavigationGuardContextValue = {
  registerGuard: (guard: NavigationGuardRegistration | null, id?: string) => void;
  tryNavigate: TryNavigateFn;
  showSaveReminder: () => void;
  allowUnloadRef: React.MutableRefObject<boolean>;
};

const NavigationGuardContext = createContext<NavigationGuardContextValue | null>(null);

export function NavigationGuardProvider({
  children,
  tryNavigateRef,
}: {
  children: React.ReactNode;
  tryNavigateRef?: React.MutableRefObject<TryNavigateFn>;
}) {
  const guardsRef = useRef<Map<string, NavigationGuardRegistration>>(new Map());
  const activeGuardRef = useRef<NavigationGuardRegistration | null>(null);
  const allowUnloadRef = useRef(false);
  const [open, setOpen] = useState(false);
  const [intent, setIntent] = useState<NavigationIntent>('leave');
  const [modalDetail, setModalDetail] = useState<SaveReminderDetail>('none');
  const [modalMessage, setModalMessage] = useState<string | undefined>(undefined);
  const [forbidExit, setForbidExit] = useState(false);
  const [pendingProceed, setPendingProceed] = useState<(() => void) | null>(null);
  const [saving, setSaving] = useState(false);

  const pickDirtyGuard = useCallback((navIntent: NavigationIntent = 'leave'): NavigationGuardRegistration | null => {
    let first: NavigationGuardRegistration | null = null;
    for (const guard of guardsRef.current.values()) {
      if (!guard.hasUnsaved()) continue;
      if (guard.logoutOnly && navIntent !== 'logout') continue;
      // Çıkışta kurulum kilidi kaydet-hatırlatmasından önce gelir
      if (navIntent === 'logout' && guard.forbidExit) return guard;
      if (!first) first = guard;
    }
    return first;
  }, []);

  const registerGuard = useCallback((guard: NavigationGuardRegistration | null, id = 'default') => {
    if (!guard) guardsRef.current.delete(id);
    else guardsRef.current.set(id, guard);
  }, []);

  const closeModal = useCallback(() => {
    setOpen(false);
    setPendingProceed(null);
    setForbidExit(false);
  }, []);

  const openModal = useCallback((navIntent: NavigationIntent, proceed: (() => void) | null) => {
    const guard = pickDirtyGuard(navIntent);
    activeGuardRef.current = guard;
    setModalDetail(guard?.detail ?? 'none');
    setModalMessage(guard?.message);
    setForbidExit(Boolean(guard?.forbidExit));
    setIntent(navIntent);
    setPendingProceed(proceed ? () => proceed : null);
    setOpen(true);
  }, [pickDirtyGuard]);

  const tryNavigate = useCallback<TryNavigateFn>((proceed, navIntent = 'leave') => {
    const guard = pickDirtyGuard(navIntent);
    if (!guard?.hasUnsaved()) {
      proceed();
      return;
    }
    openModal(navIntent, proceed);
  }, [openModal, pickDirtyGuard]);

  const showSaveReminder = useCallback(() => {
    const guard = pickDirtyGuard('leave');
    if (!guard?.hasUnsaved()) return;
    openModal('leave', null);
  }, [openModal, pickDirtyGuard]);

  useEffect(() => {
    if (!tryNavigateRef) return;
    tryNavigateRef.current = tryNavigate;
    return () => {
      tryNavigateRef.current = (proceed) => proceed();
    };
  }, [tryNavigate, tryNavigateRef]);

  const guard = activeGuardRef.current;
  const detail = modalDetail;

  const handleSave = async () => {
    if (!guard?.onSave) {
      guard?.onContinue?.();
      closeModal();
      return;
    }
    setSaving(true);
    try {
      await guard.onSave();
      closeModal();
    } finally {
      setSaving(false);
    }
  };

  const handleDiscard = async () => {
    if (forbidExit) return;
    await guard?.onDiscard?.();
    allowUnloadRef.current = true;
    const proceed = pendingProceed;
    closeModal();
    proceed?.();
  };

  const handleContinue = () => {
    guard?.onContinue?.();
    closeModal();
  };

  return (
    <NavigationGuardContext.Provider
      value={{ registerGuard, tryNavigate, showSaveReminder, allowUnloadRef }}
    >
      {children}
      <SaveReminderModal
        open={open}
        intent={intent}
        detail={detail}
        message={modalMessage}
        canSave={Boolean(guard?.onSave)}
        saving={saving || !!guard?.saving}
        forbidExit={forbidExit}
        onSave={() => void handleSave()}
        onDiscard={() => void handleDiscard()}
        onContinue={handleContinue}
      />
    </NavigationGuardContext.Provider>
  );
}

export function useNavigationGuard() {
  const ctx = useContext(NavigationGuardContext);
  if (!ctx) {
    throw new Error('useNavigationGuard must be used within NavigationGuardProvider');
  }
  return ctx;
}

/** Provider dışı bileşenler için opsiyonel erişim */
export function useNavigationGuardOptional() {
  return useContext(NavigationGuardContext);
}
