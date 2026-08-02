import { randomUUID } from 'crypto';
import type {
  ApplyLineItemOverrideInput,
  CreateTakeoffRunInput,
  PersistedTakeoffLineItem,
  PersistedTakeoffRun,
  TakeoffPersistPort,
} from '../ports/takeoff-persist.port';

/** S2/S3 test default — InMemory runs without DB RuleVersion row. */
export const IN_MEMORY_RULE_VERSION_ID = '00000000-0000-4000-8000-000000000001';

/**
 * S2 persist — tests and DI override.
 * Production default: PrismaTakeoffPersistAdapter.
 */
export class InMemoryTakeoffPersistAdapter implements TakeoffPersistPort {
  private readonly runs = new Map<string, PersistedTakeoffRun>();
  private readonly runNumbers = new Map<string, number>();

  async createRun(input: CreateTakeoffRunInput): Promise<PersistedTakeoffRun> {
    const nextNo = (this.runNumbers.get(input.claimFileId) ?? 0) + 1;
    this.runNumbers.set(input.claimFileId, nextNo);

    const runId = randomUUID();
    const createdAt = new Date();

    const lineItems = input.workItems.map((item, index) => ({
      id: randomUUID(),
      operationItemCode: item.operationItemCode,
      displayName: item.displayName,
      structureElementType: item.structureElementType,
      sourceMeasureElementId: item.sourceMeasureElementId,
      sourceMeasureVersionId: item.sourceMeasureVersionId,
      unit: item.unit,
      quantityEngine: item.quantityEngine,
      quantityFinal: item.quantityFinal,
      hasOverride: false,
      ruleCode: item.ruleCode,
      ruleVersionTag: item.ruleVersionTag,
      sortOrder: index,
      explanation: item.explanation,
      overrides: [],
    }));

    const run: PersistedTakeoffRun = {
      id: runId,
      claimFileId: input.claimFileId,
      runNumber: nextNo,
      ruleVersionId: input.ruleVersionId,
      ruleVersionTag: input.ruleVersionTag,
      status: 'active',
      note: input.note ?? null,
      createdByUserId: input.createdByUserId,
      createdAt,
      lineItems,
    };

    this.runs.set(runId, run);
    return run;
  }

  async getRun(claimFileId: string, runId: string): Promise<PersistedTakeoffRun | null> {
    const run = this.runs.get(runId);
    if (!run || run.claimFileId !== claimFileId) return null;
    return run;
  }

  async listRuns(claimFileId: string): Promise<PersistedTakeoffRun[]> {
    return [...this.runs.values()]
      .filter((r) => r.claimFileId === claimFileId)
      .sort((a, b) => b.runNumber - a.runNumber);
  }

  async applyLineItemOverride(input: ApplyLineItemOverrideInput): Promise<PersistedTakeoffLineItem> {
    const run = this.runs.get(input.runId);
    if (!run || run.claimFileId !== input.claimFileId) {
      throw new Error('Metraj koşumu bulunamadı');
    }

    const itemIndex = run.lineItems.findIndex((li) => li.id === input.lineItemId);
    if (itemIndex < 0) {
      throw new Error('İş kalemi bulunamadı');
    }

    const item = run.lineItems[itemIndex];
    const createdAt = new Date();
    const deactivatedOverrides = item.overrides.map((o) =>
      o.active ? { ...o, active: false } : o,
    );

    const override = {
      id: randomUUID(),
      quantityEnginePreserved: item.quantityEngine,
      quantityOverride: input.quantityOverride,
      reason: input.reason.trim(),
      createdByUserId: input.createdByUserId,
      createdAt,
      active: true,
    };

    const overrideSummary = `${item.quantityEngine} → ${input.quantityOverride} (${input.reason.trim()})`;

    const updatedItem: PersistedTakeoffLineItem = {
      ...item,
      quantityFinal: input.quantityOverride,
      hasOverride: true,
      overrides: [...deactivatedOverrides, override],
      explanation: {
        ...item.explanation,
        overrideSummary,
        humanReadableText: `${item.explanation.humanReadableText} · Manuel düzeltme: ${overrideSummary}`,
      },
    };

    const updatedLineItems = [...run.lineItems];
    updatedLineItems[itemIndex] = updatedItem;
    this.runs.set(input.runId, { ...run, lineItems: updatedLineItems });

    return updatedItem;
  }
}
