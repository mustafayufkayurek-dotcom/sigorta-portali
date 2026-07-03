const _apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1';
export const API = _apiBase.endsWith('/api/v1') ? _apiBase : `${_apiBase}/api/v1`;

export function getToken() {
  return typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;
}

export function authHeader() {
  return { Authorization: `Bearer ${getToken()}` };
}

export function fmtDate(d: string | null | undefined) {
  if (!d) return '—';
  const dt = new Date(d);
  return Number.isNaN(dt.getTime()) ? '—' : dt.toLocaleDateString('tr-TR');
}

export function fmtCurrency(n: number | null | undefined) {
  if (n == null) return '—';
  return n.toLocaleString('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 0 });
}

export function fmtCurrencyCompact(n: number | null | undefined) {
  if (n == null) return '—';
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `₺${(n / 1_000_000).toFixed(1)}M`;
  if (abs >= 10_000) return `₺${(n / 1_000).toFixed(0)}K`;
  return fmtCurrency(n);
}
