import { getAccessToken } from '@/utils/auth-session';

export function settingsAuthHeader(): Record<string, string> {
  const token = getAccessToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}
