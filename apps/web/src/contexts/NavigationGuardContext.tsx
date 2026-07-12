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
  onSave?: () => void | Promise<void>;
  onDiscard?: () => void | Promise<void>;
};

type TryNavigateFn = (proceed: () => void, intent?: NavigationIntent) => void;

type NavigationGuardContextValue = {
  registerGuard: (guard: NavigationGuardRegistration | null) => void;
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
  const guardRef = useRef<NavigationGuardRegistration | null>(null);
  const allowUnloadRef = useRef(false);
  const [open, setOpen] = useState(false);
  const [intent, setIntent] = useState<NavigationIntent>('leave');
  const [modalDetail, setModalDetail] = useState<SaveReminderDetail>('none');
  const [pendingProceed, setPendingProceed] = useState<(() => void) | null>(null);
  const [saving, setSaving] = useState(false);

  const registerGuard = useCallback((guard: NavigationGuardRegistration | null) => {
    guardRef.current = guard;
  }, []);

  const closeModal = useCallback(() => {
    setOpen(false);
    setPendingProceed(null);
  }, []);

  const openModal = useCallback((navIntent: NavigationIntent, proceed: (() => void) | null) => {
    const guard = guardRef.current;
    setModalDetail(guard?.detail ?? 'none');
    setIntent(navIntent);
    setPendingProceed(proceed ? () => proceed : null);
    setOpen(true);
  }, []);

  const tryNavigate = useCallback<TryNavigateFn>((proceed, navIntent = 'leave') => {
    const guard = guardRef.current;
    if (!guard?.hasUnsaved()) {
      proceed();
      return;
    }
    openModal(navIntent, proceed);
  }, [openModal]);

  const showSaveReminder = useCallback(() => {
    const guard = guardRef.current;
    if (!guard?.hasUnsaved()) return;
    openModal('leave', null);
  }, [openModal]);

  useEffect(() => {
    if (!tryNavigateRef) return;
    tryNavigateRef.current = tryNavigate;
    return () => {
      tryNavigateRef.current = (proceed) => proceed();
    };
  }, [tryNavigate, tryNavigateRef]);

  const guard = guardRef.current;
  const detail = modalDetail;

  const handleSave = async () => {
    if (!guard?.onSave) {
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
    await guard?.onDiscard?.();
    allowUnloadRef.current = true;
    const proceed = pendingProceed;
    closeModal();
    proceed?.();
  };

  const handleContinue = () => {
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
        saving={saving || !!guard?.saving}
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
