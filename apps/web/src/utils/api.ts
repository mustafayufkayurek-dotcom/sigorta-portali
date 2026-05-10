const _base = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1';
export const API = _base.endsWith('/api/v1') ? _base : `${_base}/api/v1`;

export function getToken() {
  return typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;
}

export function authHeader() {
  return { Authorization: `Bearer ${getToken()}` };
}
