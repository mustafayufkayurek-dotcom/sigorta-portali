/** Günün saatine göre panel teması — kullanıcı manuel seçim yapmamışsa */
export function isDaytimeHour(date = new Date()): boolean {
  const hour = date.getHours();
  return hour >= 6 && hour < 18;
}

export type StoredThemeConfig = {
  mode?: string;
  colorScheme?: string;
};

export function resolvePanelDarkMode(saved: StoredThemeConfig | null): boolean {
  const mode = saved?.mode ?? 'auto-time';
  if (mode === 'dark') return true;
  if (mode === 'light') return false;
  if (mode === 'system' && typeof window !== 'undefined') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  }
  return !isDaytimeHour();
}

export function applyPanelThemeToDocument(saved: StoredThemeConfig | null) {
  if (typeof document === 'undefined') return;
  const html = document.documentElement;
  const shouldUseDark = resolvePanelDarkMode(saved);
  if (saved?.colorScheme) {
    html.setAttribute('data-color-scheme', saved.colorScheme);
  } else {
    html.setAttribute('data-color-scheme', 'blue');
  }
  html.classList.toggle('dark', shouldUseDark);
  html.style.colorScheme = shouldUseDark ? 'dark' : 'light';
}
