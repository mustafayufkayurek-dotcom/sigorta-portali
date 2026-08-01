export function computeAreaM2(widthCm?: number | null, heightCm?: number | null): number | null {
  if (widthCm == null || heightCm == null) return null;
  if (!Number.isFinite(widthCm) || !Number.isFinite(heightCm)) return null;
  if (widthCm <= 0 || heightCm <= 0) return null;
  return Math.round(((widthCm / 100) * (heightCm / 100)) * 1000) / 1000;
}

export function computePerimeterM(
  widthCm?: number | null,
  heightCm?: number | null,
): number | null {
  if (widthCm == null || heightCm == null) return null;
  if (!Number.isFinite(widthCm) || !Number.isFinite(heightCm)) return null;
  if (widthCm <= 0 || heightCm <= 0) return null;
  return Math.round((2 * (widthCm / 100 + heightCm / 100)) * 1000) / 1000;
}
