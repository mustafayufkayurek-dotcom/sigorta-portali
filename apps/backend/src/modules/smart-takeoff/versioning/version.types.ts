/**
 * Versioning types.
 * No Prisma migration in this sprint — product owner approval required before migration.
 */

export interface RuleVersionRef {
  readonly id: string;
  readonly versionTag: string;
  readonly librarySnapshotHash: string;
  readonly effectiveFrom: Date;
}

export interface CalculationVersionRef {
  readonly id: string;
  readonly versionTag: string;
  readonly notes?: string;
}

export interface RunVersionRef {
  readonly takeoffRunId: string;
  readonly runNumber: number;
  readonly ruleVersionTag: string;
  readonly calculationVersionTag?: string;
  readonly status: 'draft' | 'active' | 'superseded' | 'archived';
}

/** S1 tags — not persisted until migration EVET. */
export const S1_PLACEHOLDER_CALCULATION_VERSION_TAG = 's1.math.v1';

/** @deprecated Use S1_RULE_VERSION_TAG from rule-library. */
export const S0_PLACEHOLDER_RULE_VERSION_TAG = 's0.skeleton';
export const S0_PLACEHOLDER_CALCULATION_VERSION_TAG = S1_PLACEHOLDER_CALCULATION_VERSION_TAG;
