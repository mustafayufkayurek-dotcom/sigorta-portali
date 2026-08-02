import type { OperationItemCode, TakeoffUnit } from '../domain/domain.types';

/**
 * Output of a rule evaluation (S0 skeleton).
 * Decision Engine consumes planned items; Calculation Engine fills quantities later.
 */
export interface PlannedOperationItem {
  readonly operationItemCode: OperationItemCode;
  readonly displayName: string;
  readonly unit: TakeoffUnit;
  /** Calculation strategy key — no math here. */
  readonly calculationKey: string;
  readonly calculationParams?: Readonly<Record<string, number>>;
}

export interface RuleResult {
  readonly matched: boolean;
  readonly ruleCode: string;
  readonly plannedItems: readonly PlannedOperationItem[];
  readonly notes?: readonly string[];
}
