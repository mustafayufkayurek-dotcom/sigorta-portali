import type { RuleContext } from '../rule-engine/rule-context';
import type { PlannedOperationItem } from '../rule-engine/rule-result';

/**
 * Decision Engine — decides WHICH operation items are produced.
 * Must NOT perform geometric/math calculations (ADR-04).
 */
export interface DecisionPlan {
  readonly structureElementType: string;
  readonly ruleVersionTag: string;
  readonly plannedItems: readonly PlannedOperationItem[];
  readonly decisionPath: readonly string[];
}

export interface DecisionEnginePort {
  plan(context: RuleContext): DecisionPlan;
}
