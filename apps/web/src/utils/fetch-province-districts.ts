import axios from 'axios';
import { API, authHeader } from '@/utils/api';
import { reportCaughtError } from '@/utils/report-caught-error';

export type ProvinceDistrict = { id: string; name: string };

/**
 * İl → ilçe yükleme (AbortSignal ile race önleme).
 * Eski isteğin yeni il sonucunu ezmesini engeller.
 */
export async function fetchProvinceDistricts(
  provinceId: string,
  options?: { signal?: AbortSignal; toastOnError?: boolean },
): Promise<ProvinceDistrict[]> {
  if (!provinceId) return [];
  try {
    const r = await axios.get(`${API}/locations/provinces/${provinceId}/districts`, {
      headers: authHeader(),
      signal: options?.signal,
    });
    return (r.data?.data ?? []) as ProvinceDistrict[];
  } catch (error) {
    if (axios.isCancel?.(error) || (error as { code?: string })?.code === 'ERR_CANCELED') {
      return [];
    }
    if (options?.toastOnError !== false) {
      reportCaughtError(error, 'İlçeler yüklenemedi. Lütfen ili yeniden seçin.');
    }
    return [];
  }
}
