/**
 * Calculation Engine — pure math only (S0).
 * Never decides operation items. Units: mm in → m / m² / m³ out unless noted.
 */

const MM_TO_M = 1 / 1000;

/** Rectangle area from width×height in mm → m². */
export function areaFromWidthHeightMm(widthMm: number, heightMm: number): number {
  assertNonNegative(widthMm, 'widthMm');
  assertNonNegative(heightMm, 'heightMm');
  return widthMm * MM_TO_M * (heightMm * MM_TO_M);
}

/** Axis-aligned rectangle perimeter from width×height in mm → m. */
export function perimeterFromWidthHeightMm(widthMm: number, heightMm: number): number {
  assertNonNegative(widthMm, 'widthMm');
  assertNonNegative(heightMm, 'heightMm');
  return 2 * (widthMm * MM_TO_M + heightMm * MM_TO_M);
}

/** Length in mm → m. */
export function lengthMmToM(lengthMm: number): number {
  assertNonNegative(lengthMm, 'lengthMm');
  return lengthMm * MM_TO_M;
}

/** Box volume width×height×depth in mm → m³. */
export function volumeFromBoxMm(widthMm: number, heightMm: number, depthMm: number): number {
  assertNonNegative(widthMm, 'widthMm');
  assertNonNegative(heightMm, 'heightMm');
  assertNonNegative(depthMm, 'depthMm');
  return widthMm * MM_TO_M * (heightMm * MM_TO_M) * (depthMm * MM_TO_M);
}

/** Apply dimensionless multiplier (e.g. paint coats). */
export function applyMultiplier(value: number, multiplier: number): number {
  assertNonNegative(value, 'value');
  assertNonNegative(multiplier, 'multiplier');
  return value * multiplier;
}

/**
 * Apply waste/fire percent (e.g. 8 → +8%).
 * wastePercent must be >= 0.
 */
export function applyWastePercent(value: number, wastePercent: number): number {
  assertNonNegative(value, 'value');
  assertNonNegative(wastePercent, 'wastePercent');
  return value * (1 + wastePercent / 100);
}

function assertNonNegative(n: number, name: string): void {
  if (!Number.isFinite(n) || n < 0) {
    throw new Error(`CalculationEngine: ${name} must be a finite non-negative number`);
  }
}

/** Stable quantity rounding for engine output (explainable / deterministic). */
export function roundQuantity(n: number, digits = 4): number {
  const f = 10 ** digits;
  return Math.round(n * f) / f;
}
