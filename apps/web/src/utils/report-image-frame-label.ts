import { reportImageCategoryLabel } from '@/utils/quick-repair-damage-types';

/** Çerçeve sol üst — bölüm başlığı tekrarlanmaz; dosya no + kategori. */
export function formatReportImageFrameLabel(
  fileNo: string | null | undefined,
  category?: string | null,
): string {
  const no = String(fileNo ?? '').trim() || '—';
  return `${no}/${reportImageCategoryLabel(category)}`;
}
