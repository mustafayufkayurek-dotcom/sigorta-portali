const REPORT_IMAGE_CATEGORY_KEYS = ['before', 'damage', 'after'] as const;
export type ReportImageCategoryKey = (typeof REPORT_IMAGE_CATEGORY_KEYS)[number];

export function normalizeReportImageCategory(raw?: string | null): ReportImageCategoryKey {
  const v = (raw ?? '').trim().toLowerCase();
  if (v === 'before' || v === 'tespit') return 'before';
  if (v === 'damage' || v === 'onarım' || v === 'onarim') return 'damage';
  if (v === 'after' || v === 'onarım sonrası' || v === 'onarim sonrasi' || v === 'sonrası' || v === 'sonrasi') {
    return 'after';
  }
  if (REPORT_IMAGE_CATEGORY_KEYS.includes(v as ReportImageCategoryKey)) {
    return v as ReportImageCategoryKey;
  }
  return 'damage';
}
