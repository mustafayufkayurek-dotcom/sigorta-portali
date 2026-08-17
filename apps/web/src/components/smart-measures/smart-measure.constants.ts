/** Web — AI + AR Akıllı Ölçüm (görüntü katmanı; hesap mm API’den gelir) */

export const SMART_MEASURE_ELEMENT_TYPE_LABELS: Record<string, string> = {
  kapi: 'Kapı',
  pencere: 'Pencere',
  mutfak_dolabi: 'Mutfak Dolabı',
  banyo_dolabi: 'Banyo Dolabı',
  tezgah: 'Tezgâh',
  duvar: 'Duvar',
  cam: 'Cam',
  seramik: 'Seramik',
  fayans: 'Fayans',
  parke: 'Parke',
  tavan: 'Tavan',
  kolon: 'Kolon',
  kiris: 'Kiriş',
  lavabo: 'Lavabo',
  klozet: 'Klozet',
  dusakabin: 'Duşakabin',
  klima: 'Klima',
  radyator: 'Radyatör',
  merdiven: 'Merdiven',
  asma_tavan: 'Asma Tavan',
  pvc_dograma: 'Pvc Doğrama',
  ahsap_dograma: 'Ahşap Doğrama',
  diger: 'Diğer',
};

export const AI_CONFIDENCE_LEVEL_LABELS: Record<string, string> = {
  very_high: 'Very High',
  high: 'High',
  medium: 'Medium',
  low: 'Low',
};

export function smartMeasureElementTypeLabel(code: string): string {
  return SMART_MEASURE_ELEMENT_TYPE_LABELS[code] ?? code;
}

/** API mm döner; UI cm gösterir (hesap yok — yalnız dönüşüm) */
export function formatSmartMeasureDims(v: {
  widthMm?: number | null;
  heightMm?: number | null;
  depthMm?: number | null;
  areaM2?: number | null;
  display?: {
    widthCm?: number | null;
    heightCm?: number | null;
    depthCm?: number | null;
  } | null;
}): string {
  const w = v.display?.widthCm ?? (v.widthMm != null ? v.widthMm / 10 : null);
  const h = v.display?.heightCm ?? (v.heightMm != null ? v.heightMm / 10 : null);
  const d = v.display?.depthCm ?? (v.depthMm != null ? v.depthMm / 10 : null);
  const parts: string[] = [];
  if (w != null) parts.push(`${Number(w.toFixed(1))} cm`);
  if (h != null) parts.push(`${Number(h.toFixed(1))} cm`);
  if (d != null) parts.push(`${Number(d.toFixed(1))} cm`);
  const dim = parts.length ? parts.join(' × ') : '—';
  if (v.areaM2 != null) return `${dim} · ${v.areaM2} m²`;
  return dim;
}
