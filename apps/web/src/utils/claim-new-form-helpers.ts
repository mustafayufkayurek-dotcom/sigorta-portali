/** Yeni hasar dosyası — sessiz kullanıcı tercihleri */

export const CLAIM_NEW_PREFS_KEY = 'meridyen:claim-new-prefs';

export type ClaimNewPrefs = {
  insuranceCompanyId?: string;
  lossType?: string;
};

export function todayTrDateDisplay(): string {
  const now = new Date();
  const dd = String(now.getDate()).padStart(2, '0');
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const yyyy = now.getFullYear();
  return `${dd}.${mm}.${yyyy}`;
}

export function loadClaimNewPrefs(): ClaimNewPrefs {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(CLAIM_NEW_PREFS_KEY);
    return raw ? (JSON.parse(raw) as ClaimNewPrefs) : {};
  } catch {
    return {};
  }
}

export function saveClaimNewPrefs(prefs: ClaimNewPrefs): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(CLAIM_NEW_PREFS_KEY, JSON.stringify(prefs));
  } catch { /* quota */ }
}
