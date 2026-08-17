/**
 * Calculation strategies — pure math bindings only.
 * Never selects operation items (Decision / Rule Library responsibility).
 */

import type { MeasureReadSnapshot } from '../ports/measure-read.port';
import type { PlannedOperationItem } from '../rule-engine/rule-result';
import { CalculationKeys } from '../domain/domain.types';
import type { ExplanationStep } from '../explanation/calculation-explanation.model';
import * as math from './calculation.math';
import type { CalculationResult } from './calculation-result';

export function computeQuantity(
  item: PlannedOperationItem,
  measure: MeasureReadSnapshot,
): CalculationResult {
  switch (item.calculationKey) {
    case CalculationKeys.AREA_M2_FROM_WXH:
      return areaFromWxH(item, measure, 1);
    case CalculationKeys.AREA_M2_FROM_WXH_WITH_COATS: {
      const coats = item.calculationParams?.coats ?? 1;
      return areaFromWxH(item, measure, coats);
    }
    case CalculationKeys.LENGTH_M_FROM_MM:
      return lengthFromMm(item, measure);
    default:
      throw new Error(`CalculationEngine: unknown calculationKey "${item.calculationKey}"`);
  }
}

function areaFromWxH(
  item: PlannedOperationItem,
  measure: MeasureReadSnapshot,
  coats: number,
): CalculationResult {
  const widthMm = requireDim(measure.widthMm, 'widthMm');
  const heightMm = requireDim(measure.heightMm, 'heightMm');
  const area = math.areaFromWidthHeightMm(widthMm, heightMm);
  const quantity = math.roundQuantity(math.applyMultiplier(area, coats));

  const steps: ExplanationStep[] = [
    {
      order: 1,
      label: 'Ölçü',
      input: { widthMm, heightMm },
      output: `${widthMm} × ${heightMm} mm`,
    },
    {
      order: 2,
      label: 'Alan',
      input: { widthMm, heightMm },
      output: math.roundQuantity(area),
    },
  ];
  if (coats !== 1) {
    steps.push({
      order: 3,
      label: 'Kat Çarpanı',
      input: { coats, area: math.roundQuantity(area) },
      output: quantity,
    });
  }

  return { quantityEngine: quantity, unit: item.unit, steps };
}

function lengthFromMm(
  item: PlannedOperationItem,
  measure: MeasureReadSnapshot,
): CalculationResult {
  const lengthMm = requireDim(measure.lengthMm, 'lengthMm');
  const quantity = math.roundQuantity(math.lengthMmToM(lengthMm));
  const steps: ExplanationStep[] = [
    {
      order: 1,
      label: 'Ölçü',
      input: { lengthMm },
      output: `${lengthMm} mm`,
    },
    {
      order: 2,
      label: 'Uzunluk',
      input: { lengthMm },
      output: quantity,
    },
  ];
  return { quantityEngine: quantity, unit: item.unit, steps };
}

function requireDim(value: number | null | undefined, name: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    throw new Error(`CalculationEngine: ${name} required and must be > 0`);
  }
  return value;
}
