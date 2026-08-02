import { Prisma } from '@prisma/client';
import { PrismaTakeoffPersistAdapter } from '../adapters/prisma-takeoff-persist.adapter';
import { StructureElementTypes, OperationItemCodes } from '../domain/domain.types';
import { emptyExplanation } from '../explanation/calculation-explanation.model';
import type { OperationWorkItem } from '../domain/operation-work-item';
import { S1_RULE_IDS, S1_RULE_VERSION_ID } from '../versioning/rule-version-resolver';

function buildWorkItem(partial: Partial<OperationWorkItem> = {}): OperationWorkItem {
  return {
    operationItemCode: OperationItemCodes.DOOR_PUTTY,
    displayName: 'Kapı Macun',
    unit: 'm2',
    quantityEngine: 1.89,
    quantityFinal: 1.89,
    structureElementType: StructureElementTypes.DOOR,
    sourceMeasureElementId: 'me-1',
    sourceMeasureVersionId: 'mv-1',
    ruleCode: 'DOOR_PAINTING_SET',
    ruleVersionTag: 's1.2026.08.02.1',
    decisionPath: ['DOOR_PAINTING_SET'],
    explanation: emptyExplanation({
      measureSummary: '2100×900 mm',
      ruleCode: 'DOOR_PAINTING_SET',
      ruleVersionTag: 's1.2026.08.02.1',
      humanReadableText: 'Kapı Macun — 1,89 m²',
    }),
    ...partial,
  };
}

describe('S3 — PrismaTakeoffPersistAdapter (mocked Prisma)', () => {
  const ruleRows = [
    { id: S1_RULE_IDS.DOOR_PAINTING_SET, code: 'DOOR_PAINTING_SET' },
    { id: S1_RULE_IDS.WINDOW_PAINTING_SET, code: 'WINDOW_PAINTING_SET' },
    { id: S1_RULE_IDS.SKIRTING_INSTALL_SET, code: 'SKIRTING_INSTALL_SET' },
    { id: S1_RULE_IDS.CEILING_PAINTING_SET, code: 'CEILING_PAINTING_SET' },
  ];

  function buildAdapter() {
    const prisma = {
      takeoffRule: {
        findMany: jest.fn().mockResolvedValue(ruleRows),
      },
      takeoffRun: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
      },
      $transaction: jest.fn((fn: (tx: typeof prisma) => Promise<unknown>) => fn(prisma)),
    };

    const adapter = new PrismaTakeoffPersistAdapter(prisma as never);
    return { adapter, prisma };
  }

  it('createRun persists run with line items and explanation', async () => {
    const { adapter, prisma } = buildAdapter();
    prisma.takeoffRun.findFirst.mockResolvedValue(null);
    prisma.takeoffRun.create.mockResolvedValue({
      id: 'run-1',
      claimFileId: 'cf-1',
      ruleVersionId: S1_RULE_VERSION_ID,
      runNumber: 1,
      status: 'active',
      note: 'S3 test',
      createdByUserId: 'user-1',
      createdAt: new Date('2026-08-02T12:00:00Z'),
      ruleVersion: { versionTag: 's1.2026.08.02.1' },
      lineItems: [
        {
          id: 'li-1',
          operationItemCode: OperationItemCodes.DOOR_PUTTY,
          displayName: 'Kapı Macun',
          structureElementType: StructureElementTypes.DOOR,
          sourceMeasureElementId: 'me-1',
          unit: 'm2',
          quantityEngine: new Prisma.Decimal('1.8900'),
          quantityFinal: new Prisma.Decimal('1.8900'),
          sortOrder: 0,
          sources: [{ smartMeasureVersionId: 'mv-1' }],
          explanation: {
            ruleCode: 'DOOR_PAINTING_SET',
            ruleVersionTag: 's1.2026.08.02.1',
            measureSummary: '2100×900 mm',
            decisionPathJson: ['DOOR_PAINTING_SET'],
            calculationStepsJson: [{ order: 1, label: 'Alan', output: 1.89 }],
            overrideSummaryJson: null,
            humanReadableText: 'Kapı Macun — 1,89 m²',
          },
        },
      ],
    });

    const result = await adapter.createRun({
      claimFileId: 'cf-1',
      ruleVersionId: S1_RULE_VERSION_ID,
      ruleVersionTag: 's1.2026.08.02.1',
      note: 'S3 test',
      createdByUserId: 'user-1',
      workItems: [buildWorkItem()],
    });

    expect(result.id).toBe('run-1');
    expect(result.ruleVersionId).toBe(S1_RULE_VERSION_ID);
    expect(result.runNumber).toBe(1);
    expect(result.lineItems).toHaveLength(1);
    expect(result.lineItems[0].displayName).toBe('Kapı Macun');
    expect(result.lineItems[0].explanation.humanReadableText).toContain('Kapı Macun');
    expect(prisma.takeoffRun.create).toHaveBeenCalledTimes(1);
  });

  it('getRun returns null for wrong claimFileId', async () => {
    const { adapter, prisma } = buildAdapter();
    prisma.takeoffRun.findFirst.mockResolvedValue(null);

    const result = await adapter.getRun('cf-other', 'run-1');
    expect(result).toBeNull();
  });

  it('listRuns maps runs in descending runNumber order', async () => {
    const { adapter, prisma } = buildAdapter();
    prisma.takeoffRun.findMany.mockResolvedValue([
      {
        id: 'run-2',
        claimFileId: 'cf-1',
        ruleVersionId: S1_RULE_VERSION_ID,
        runNumber: 2,
        status: 'active',
        note: null,
        createdByUserId: 'user-1',
        createdAt: new Date(),
        ruleVersion: { versionTag: 's1.2026.08.02.1' },
        lineItems: [],
      },
    ]);

    const runs = await adapter.listRuns('cf-1');
    expect(runs).toHaveLength(1);
    expect(runs[0].runNumber).toBe(2);
  });
});
