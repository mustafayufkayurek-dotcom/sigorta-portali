import type { ExplanationStep } from '../explanation/calculation-explanation.model';

export interface CalculationResult {
  readonly quantityEngine: number;
  readonly unit: string;
  readonly steps: readonly ExplanationStep[];
}
