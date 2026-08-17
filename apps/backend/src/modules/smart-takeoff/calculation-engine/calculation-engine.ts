import { Injectable } from '@nestjs/common';
import type { MeasureReadSnapshot } from '../ports/measure-read.port';
import type { PlannedOperationItem } from '../rule-engine/rule-result';
import * as math from './calculation.math';
import { computeQuantity } from './calculation-strategies';
import type { CalculationResult } from './calculation-result';

/**
 * Calculation Engine facade.
 * Exposes pure math only — never decides operation items.
 */
@Injectable()
export class CalculationEngine {
  areaFromWidthHeightMm(widthMm: number, heightMm: number): number {
    return math.areaFromWidthHeightMm(widthMm, heightMm);
  }

  perimeterFromWidthHeightMm(widthMm: number, heightMm: number): number {
    return math.perimeterFromWidthHeightMm(widthMm, heightMm);
  }

  lengthMmToM(lengthMm: number): number {
    return math.lengthMmToM(lengthMm);
  }

  volumeFromBoxMm(widthMm: number, heightMm: number, depthMm: number): number {
    return math.volumeFromBoxMm(widthMm, heightMm, depthMm);
  }

  applyMultiplier(value: number, multiplier: number): number {
    return math.applyMultiplier(value, multiplier);
  }

  applyWastePercent(value: number, wastePercent: number): number {
    return math.applyWastePercent(value, wastePercent);
  }

  roundQuantity(n: number, digits?: number): number {
    return math.roundQuantity(n, digits);
  }

  /** Compute quantity for a planned item — math only. */
  computeForItem(
    item: PlannedOperationItem,
    measure: MeasureReadSnapshot,
  ): CalculationResult {
    return computeQuantity(item, measure);
  }
}
