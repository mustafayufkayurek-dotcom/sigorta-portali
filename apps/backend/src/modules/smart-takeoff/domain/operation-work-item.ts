import type { CalculationExplanationModel } from '../explanation/calculation-explanation.model';
import type { TakeoffUnit } from '../domain/domain.types';

/**
 * Materialized Operation Work Item — pipeline output (no persistence in S1).
 * quantityFinal === quantityEngine until Override sprint.
 */
export interface OperationWorkItem {
  readonly operationItemCode: string;
  readonly displayName: string;
  readonly unit: TakeoffUnit;
  readonly quantityEngine: number;
  readonly quantityFinal: number;
  readonly structureElementType: string;
  readonly sourceMeasureElementId: string;
  readonly sourceMeasureVersionId: string;
  readonly ruleCode: string;
  readonly ruleVersionTag: string;
  readonly decisionPath: readonly string[];
  readonly explanation: CalculationExplanationModel;
}
