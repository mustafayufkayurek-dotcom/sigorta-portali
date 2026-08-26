export const OPS_LIST_PAGE_SIZE_OPTIONS = [20, 50, 100, 150] as const;

export type OpsListPageSize = (typeof OPS_LIST_PAGE_SIZE_OPTIONS)[number];

export const OPS_LIST_PAGE_SIZE_KEYS = {
  hasar: 'ops-list-page-size:hasar-dosyalari',
  acil: 'ops-list-page-size:acil',
} as const;

export function parseOpsListPageSize(
  raw: string | null | undefined,
  fallback: OpsListPageSize,
): OpsListPageSize {
  const n = Number(raw);
  return (OPS_LIST_PAGE_SIZE_OPTIONS as readonly number[]).includes(n)
    ? (n as OpsListPageSize)
    : fallback;
}

export function readOpsListPageSize(
  storageKey: string,
  fallback: OpsListPageSize,
): OpsListPageSize {
  if (typeof window === 'undefined') return fallback;
  try {
    return parseOpsListPageSize(window.localStorage.getItem(storageKey), fallback);
  } catch {
    return fallback;
  }
}

export function writeOpsListPageSize(storageKey: string, value: OpsListPageSize): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(storageKey, String(value));
  } catch {
    /* ignore */
  }
}
