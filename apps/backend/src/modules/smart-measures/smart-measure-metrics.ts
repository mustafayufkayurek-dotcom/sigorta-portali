/** Operasyon zekâsı — alan / çevre / hacim (kanonik mm integer) */

export function computeAreaMm2(widthMm?: number | null, heightMm?: number | null): number | null {
  if (widthMm == null || heightMm == null) return null;
  if (!Number.isFinite(widthMm) || !Number.isFinite(heightMm)) return null;
  if (widthMm <= 0 || heightMm <= 0) return null;
  return Math.round(widthMm * heightMm);
}

export function computePerimeterMm(
  widthMm?: number | null,
  heightMm?: number | null,
): number | null {
  if (widthMm == null || heightMm == null) return null;
  if (!Number.isFinite(widthMm) || !Number.isFinite(heightMm)) return null;
  if (widthMm <= 0 || heightMm <= 0) return null;
  return Math.round(2 * (widthMm + heightMm));
}

export function computeVolumeMm3(
  widthMm?: number | null,
  heightMm?: number | null,
  depthMm?: number | null,
): number | null {
  if (widthMm == null || heightMm == null || depthMm == null) return null;
  if (![widthMm, heightMm, depthMm].every((n) => Number.isFinite(n) && n > 0)) return null;
  return Math.round(widthMm * heightMm * depthMm);
}

/** UI / rapor için türetilmiş birimler — hesap her zaman mm üzerinden */
export function mmToCm(mm: number): number {
  return mm / 10;
}

export function mmToM(mm: number): number {
  return mm / 1000;
}

export function areaMm2ToM2(areaMm2: number): number {
  return Math.round((areaMm2 / 1_000_000) * 1000) / 1000;
}

export function perimeterMmToM(perimeterMm: number): number {
  return Math.round((perimeterMm / 1000) * 1000) / 1000;
}

export function volumeMm3ToM3(volumeMm3: number): number {
  return Math.round((volumeMm3 / 1_000_000_000) * 1000) / 1000;
}

export type AiConfidenceLevel = 'very_high' | 'high' | 'medium' | 'low';

export function resolveAiConfidenceLevel(
  confidence: number | null | undefined,
): AiConfidenceLevel | null {
  if (confidence == null || !Number.isFinite(confidence)) return null;
  const v = confidence > 1 ? confidence / 100 : confidence;
  if (v >= 0.9) return 'very_high';
  if (v >= 0.75) return 'high';
  if (v >= 0.5) return 'medium';
  return 'low';
}

export const AI_CONFIDENCE_LEVEL_LABELS: Record<AiConfidenceLevel, string> = {
  very_high: 'Very High',
  high: 'High',
  medium: 'Medium',
  low: 'Low',
};
