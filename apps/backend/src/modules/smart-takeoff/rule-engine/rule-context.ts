import type { MeasureReadSnapshot } from '../ports/measure-read.port';

/**
 * Immutable evaluation context for Rule Engine (S0 skeleton).
 */
export interface RuleContext {
  readonly claimFileId: string;
  readonly ruleVersionTag: string;
  readonly measure: MeasureReadSnapshot;
  /** Opaque bag for future Decision/Calculation bindings — no business keys yet. */
  readonly attributes?: Readonly<Record<string, unknown>>;
}
