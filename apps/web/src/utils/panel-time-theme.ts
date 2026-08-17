/** Enterprise shell v3 — 5 tema + token tabanlı renk şeması */

export const PANEL_FORCE_LIGHT_MODE = false;

/** Günün saatine göre panel teması — kullanıcı manuel seçim yapmamışsa */
export function isDaytimeHour(date = new Date()): boolean {
  const hour = date.getHours();
  return hour >= 6 && hour < 18;
}

/** Panel tema seçenekleri (v3.0) */
export type PanelThemeMode =
  | 'light'
  | 'dark'
  | 'corporate-blue'
  | 'corporate-dark'
  | 'high-contrast'
  | 'auto-time'
  | 'system';

export type StoredThemeConfig = {
  mode?: PanelThemeMode | string;
  colorScheme?: string;
};

export const PANEL_THEME_OPTIONS: Array<{
  id: PanelThemeMode;
  label: string;
  description: string;
}> = [
  { id: 'light', label: 'Açık', description: 'Varsayılan gündüz' },
  { id: 'dark', label: 'Koyu', description: 'Vardiya / gece' },
  { id: 'corporate-blue', label: 'Kurumsal Mavi', description: 'Navy / mavi token' },
  { id: 'corporate-dark', label: 'Kurumsal Koyu', description: 'Koyu navy yüzey' },
  { id: 'high-contrast', label: 'Yüksek Kontrast', description: 'WCAG AA+ kenarlar' },
];

export function resolvePanelDarkMode(saved: StoredThemeConfig | null): boolean {
  if (PANEL_FORCE_LIGHT_MODE) return false;
  const mode = saved?.mode ?? 'light';
  if (mode === 'dark' || mode === 'corporate-dark') return true;
  if (mode === 'light' || mode === 'corporate-blue' || mode === 'high-contrast') return false;
  if (mode === 'system' && typeof window !== 'undefined') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  }
  if (mode === 'auto-time') return !isDaytimeHour();
  return false;
}

export function resolvePanelThemeAttr(saved: StoredThemeConfig | null): string {
  const mode = saved?.mode ?? 'light';
  if (mode === 'corporate-blue') return 'corporate-blue';
  if (mode === 'corporate-dark') return 'corporate-dark';
  if (mode === 'high-contrast') return 'high-contrast';
  if (mode === 'dark') return 'dark';
  return 'light';
}

export function applyPanelThemeToDocument(saved: StoredThemeConfig | null) {
  if (typeof document === 'undefined') return;
  const html = document.documentElement;
  const shouldUseDark = resolvePanelDarkMode(saved);
  const themeAttr = resolvePanelThemeAttr(saved);

  html.setAttribute('data-panel-theme', themeAttr);
  html.setAttribute(
    'data-color-scheme',
    saved?.colorScheme ?? (themeAttr === 'corporate-blue' || themeAttr === 'corporate-dark' ? 'navy' : 'blue'),
  );
  html.classList.toggle('dark', shouldUseDark);
  html.classList.toggle('high-contrast', themeAttr === 'high-contrast');
  html.style.colorScheme = shouldUseDark ? 'dark' : 'light';
}
