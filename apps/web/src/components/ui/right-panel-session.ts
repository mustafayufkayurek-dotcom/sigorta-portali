export const RIGHT_PANEL_SESSION_KEY = 'right-panel-dock-session-v1';
export const RIGHT_PANEL_SESSION_EVENT = 'right-panel-session-change';

export type RightPanelRestore = {
  kind: string;
  [key: string]: string;
};

export type RightPanelSession = {
  title: string;
  href: string;
  docked: boolean;
  restore?: RightPanelRestore;
};

export function currentPanelHref(path?: string, search?: string): string {
  if (typeof window === 'undefined') {
    return `${path ?? ''}${search ?? ''}`;
  }
  const pathname = path ?? window.location.pathname;
  const query = search ?? window.location.search;
  return `${pathname}${query}`;
}

export function hrefMatchesSession(sessionHref: string, currentHref: string): boolean {
  const normalize = (value: string) => value.replace(/\/+$/, '') || '/';
  return normalize(sessionHref) === normalize(currentHref);
}

export function readRightPanelSession(): RightPanelSession | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.sessionStorage.getItem(RIGHT_PANEL_SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as RightPanelSession;
    if (!parsed?.href || typeof parsed.title !== 'string') return null;
    return parsed;
  } catch {
    return null;
  }
}

export function writeRightPanelSession(session: RightPanelSession): void {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(RIGHT_PANEL_SESSION_KEY, JSON.stringify(session));
    window.dispatchEvent(new Event(RIGHT_PANEL_SESSION_EVENT));
  } catch {
    /* ignore quota */
  }
}

export function clearRightPanelSession(): void {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.removeItem(RIGHT_PANEL_SESSION_KEY);
    window.dispatchEvent(new Event(RIGHT_PANEL_SESSION_EVENT));
  } catch {
    /* ignore */
  }
}

export function patchRightPanelSession(
  patch: Partial<RightPanelSession>,
): RightPanelSession | null {
  const current = readRightPanelSession();
  if (!current) return null;
  const next = { ...current, ...patch };
  writeRightPanelSession(next);
  return next;
}
