import type { OperationWorkItem } from '../domain/operation-work-item';

export const TAKEOFF_PERSIST_PORT = Symbol('TAKEOFF_PERSIST_PORT');

export interface PersistedManualOverride {
  readonly id: string;
  readonly quantityEnginePreserved: number;
  readonly quantityOverride: number;
  readonly reason: string;
  readonly createdByUserId: string;
  readonly createdAt: Date;
  readonly active: boolean;
}

export interface PersistedTakeoffLineItem {
  readonly id: string;
  readonly operationItemCode: string;
  readonly displayName: string;
  readonly structureElementType: string;
  readonly sourceMeasureElementId: string | null;
  readonly sourceMeasureVersionId: string | null;
  readonly unit: string;
  readonly quantityEngine: number;
  readonly quantityFinal: number;
  readonly hasOverride: boolean;
  readonly ruleCode: string;
  readonly ruleVersionTag: string;
  readonly sortOrder: number;
  readonly explanation: OperationWorkItem['explanation'];
  readonly overrides: readonly PersistedManualOverride[];
}

export interface PersistedTakeoffRun {
  readonly id: string;
  readonly claimFileId: string;
  readonly runNumber: number;
  readonly ruleVersionId: string;
  readonly ruleVersionTag: string;
  readonly status: string;
  readonly note: string | null;
  readonly createdByUserId: string;
  readonly createdAt: Date;
  readonly lineItems: readonly PersistedTakeoffLineItem[];
}

export interface CreateTakeoffRunInput {
  readonly claimFileId: string;
  readonly ruleVersionId: string;
  readonly ruleVersionTag: string;
  readonly note?: string | null;
  readonly createdByUserId: string;
  readonly workItems: readonly OperationWorkItem[];
}

export interface ApplyLineItemOverrideInput {
  readonly claimFileId: string;
  readonly runId: string;
  readonly lineItemId: string;
  readonly quantityOverride: number;
  readonly reason: string;
  readonly createdByUserId: string;
}

export interface TakeoffPersistPort {
  createRun(input: CreateTakeoffRunInput): Promise<PersistedTakeoffRun>;
  getRun(claimFileId: string, runId: string): Promise<PersistedTakeoffRun | null>;
  listRuns(claimFileId: string): Promise<PersistedTakeoffRun[]>;
  applyLineItemOverride(input: ApplyLineItemOverrideInput): Promise<PersistedTakeoffLineItem>;
}
