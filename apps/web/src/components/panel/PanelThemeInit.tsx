'use client';

import { useEffect } from 'react';
import {
  applyPanelThemeToDocument,
  type StoredThemeConfig,
} from '@/utils/panel-time-theme';

function readTheme(): StoredThemeConfig | null {
  try {
    const raw = localStorage.getItem('app-theme');
    if (!raw) return null;
    return JSON.parse(raw) as StoredThemeConfig;
  } catch {
    return null;
  }
}

/**
 * Kök layout tema uygulayıcısı — panel dışı sayfalar dahil tüm uygulamada
 * html.dark / data-panel-theme senkronu (FOUC azaltır, sayfa geçişinde kalır).
 */
export default function PanelThemeInit() {
  useEffect(() => {
    const apply = () => applyPanelThemeToDocument(readTheme());
    apply();
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'app-theme') apply();
    };
    const onCustom = () => apply();
    window.addEventListener('storage', onStorage);
    window.addEventListener('theme-changed', onCustom);
    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('theme-changed', onCustom);
    };
  }, []);

  return null;
}
