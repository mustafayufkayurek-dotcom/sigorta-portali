import type { RuleContext } from './rule-context';
import type { RuleResult } from './rule-result';

/**
 * Rule contract — Rule Independence (ADR-16).
 * Rules live in Rule Library / versions; not embedded in Nest controllers.
 * S0: zero registered rules.
 */
export interface TakeoffRule {
  readonly code: string;
  readonly structureElementType: string;
  /** Evaluates in a versioned context. S0: no concrete rules. */
  evaluate(context: RuleContext): RuleResult;
}
