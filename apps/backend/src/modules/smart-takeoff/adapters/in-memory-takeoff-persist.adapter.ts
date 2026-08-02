import { randomUUID } from 'crypto';
import type {
  CreateTakeoffRunInput,
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
      ruleCode: item.ruleCode,
      ruleVersionTag: item.ruleVersionTag,
      sortOrder: index,
      explanation: item.explanation,
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
}
