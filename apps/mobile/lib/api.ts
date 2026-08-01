import * as SecureStore from 'expo-secure-store';

/** Geliştirme: localhost · Canlı: EXPO_PUBLIC_API_URL */
export const API_BASE =
  (typeof process !== 'undefined' && process.env?.EXPO_PUBLIC_API_URL) ||
  'http://localhost:3000/api/v1';

export async function authHeader(): Promise<Record<string, string>> {
  const token = await SecureStore.getItemAsync('accessToken');
  return token ? { Authorization: `Bearer ${token}` } : {};
}
