'use client';

import { useEffect } from 'react';
import {
  AUTH_LOGOUT_BROADCAST_KEY,
  clearAuth,
  initAuthStorage,
  isPasswordLoginRequired,
} from '@/utils/auth-session';

/** Her sayfa yüklemesinde eski token sızıntılarını temizler; sekme çıkışını dinler */
export default function AuthStorageInit() {
  useEffect(() => {
    initAuthStorage();

    const onStorage = (e: StorageEvent) => {
      if (e.key !== AUTH_LOGOUT_BROADCAST_KEY || e.newValue == null) return;
      clearAuth({ preserveRememberedEmail: true });
      try {
        sessionStorage.clear();
      } catch {
        /* ignore */
      }
      if (!window.location.pathname.startsWith('/giris')) {
        window.location.href = '/giris?reason=logout';
      }
    };

    const onPageShow = (e: PageTransitionEvent) => {
      // bfcache geri dönüşünde çıkış kilidi varsa panele sızma
      if (e.persisted && isPasswordLoginRequired() && !window.location.pathname.startsWith('/giris')) {
        window.location.href = '/giris?reason=logout';
      }
    };

    window.addEventListener('storage', onStorage);
    window.addEventListener('pageshow', onPageShow);
    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('pageshow', onPageShow);
    };
  }, []);
  return null;
}
