import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import type { CalculationExplanationModel } from '../explanation/calculation-explanation.model';
import type {
  CreateTakeoffRunInput,
  PersistedTakeoffLineItem,
  PersistedTakeoffRun,
  TakeoffPersistPort,
} from '../ports/takeoff-persist.port';

const RUN_INCLUDE = {
  ruleVersion: true,
  lineItems: {
    orderBy: { sortOrder: 'asc' as const },
    include: {
      explanation: true,
      sources: true,
      rule: true,
    },
  },
} satisfies Prisma.TakeoffRunInclude;

type RunWithRelations = Prisma.TakeoffRunGetPayload<{ include: typeof RUN_INCLUDE }>;

@Injectable()
export class PrismaTakeoffPersistAdapter implements TakeoffPersistPort {
  constructor(private readonly prisma: PrismaService) {}

  async createRun(input: CreateTakeoffRunInput): Promise<PersistedTakeoffRun> {
    const ruleByCode = await this.loadRulesByCode();

    const lastRun = await this.prisma.takeoffRun.findFirst({
      where: { claimFileId: input.claimFileId },
      orderBy: { runNumber: 'desc' },
      select: { runNumber: true },
    });
    const runNumber = (lastRun?.runNumber ?? 0) + 1;

    const created = await this.prisma.$transaction(async (tx) => {
      return tx.takeoffRun.create({
        data: {
          claimFileId: input.claimFileId,
          ruleVersionId: input.ruleVersionId,
          runNumber,
          status: 'active',
          note: input.note ?? null,
          createdByUserId: input.createdByUserId,
          lineItems: {
            create: input.workItems.map((item, index) => {
              const ruleId = ruleByCode.get(item.ruleCode)?.id;
              if (!ruleId) {
                throw new Error(`TakeoffRule bulunamadı: ${item.ruleCode}`);
              }

              return {
                operationItemCode: item.operationItemCode,
                displayName: item.displayName,
                structureElementType: item.structureElementType,
                sourceMeasureElementId: item.sourceMeasureElementId,
                unit: item.unit,
                quantityEngine: item.quantityEngine,
                quantityFinal: item.quantityFinal,
                hasOverride: false,
                ruleId,
                ruleVersionId: input.ruleVersionId,
                metrajSnapshotJson: buildMetrajSnapshot(item.explanation),
                sortOrder: index,
                status: 'active' as const,
                explanation: {
                  create: {
                    measureSummary: item.explanation.measureSummary,
                    ruleCode: item.explanation.ruleCode,
                    ruleVersionTag: item.explanation.ruleVersionTag,
                    decisionPathJson: item.explanation.decisionPath as Prisma.InputJsonValue,
                    calculationStepsJson: item.explanation.calculationSteps as Prisma.InputJsonValue,
                    overrideSummaryJson: item.explanation.overrideSummary ?? Prisma.JsonNull,
                    humanReadableText: item.explanation.humanReadableText,
                  },
                },
                sources: {
                  create: [
                    {
                      smartMeasureVersionId: item.sourceMeasureVersionId,
                    },
                  ],
                },
              };
            }),
          },
        },
        include: RUN_INCLUDE,
      });
    });

    return mapRun(created);
  }

  async getRun(claimFileId: string, runId: string): Promise<PersistedTakeoffRun | null> {
    const run = await this.prisma.takeoffRun.findFirst({
      where: { id: runId, claimFileId },
      include: RUN_INCLUDE,
    });
    return run ? mapRun(run) : null;
  }

  async listRuns(claimFileId: string): Promise<PersistedTakeoffRun[]> {
    const runs = await this.prisma.takeoffRun.findMany({
      where: { claimFileId },
      orderBy: { runNumber: 'desc' },
      include: RUN_INCLUDE,
    });
    return runs.map(mapRun);
  }

  private async loadRulesByCode() {
    const rules = await this.prisma.takeoffRule.findMany({
      where: { active: true },
      select: { id: true, code: true },
    });
    return new Map(rules.map((r) => [r.code, r]));
  }
}

function buildMetrajSnapshot(explanation: CalculationExplanationModel): Prisma.InputJsonValue {
  return {
    measureSummary: explanation.measureSummary,
    ruleCode: explanation.ruleCode,
  };
}

function mapRun(run: RunWithRelations): PersistedTakeoffRun {
  return {
    id: run.id,
    claimFileId: run.claimFileId,
    runNumber: run.runNumber,
    ruleVersionId: run.ruleVersionId,
    ruleVersionTag: run.ruleVersion.versionTag,
    status: run.status,
    note: run.note,
    createdByUserId: run.createdByUserId,
    createdAt: run.createdAt,
    lineItems: run.lineItems.map(mapLineItem),
  };
}

function mapLineItem(
  item: RunWithRelations['lineItems'][number],
): PersistedTakeoffLineItem {
  const explanation = item.explanation;
  if (!explanation) {
    throw new Error(`TakeoffLineItem ${item.id} explanation eksik`);
  }

  return {
    id: item.id,
    operationItemCode: item.operationItemCode,
    displayName: item.displayName,
    structureElementType: item.structureElementType,
    sourceMeasureElementId: item.sourceMeasureElementId,
    sourceMeasureVersionId: item.sources[0]?.smartMeasureVersionId ?? null,
    unit: item.unit,
    quantityEngine: decimalToNumber(item.quantityEngine),
    quantityFinal: decimalToNumber(item.quantityFinal),
    ruleCode: explanation.ruleCode,
    ruleVersionTag: explanation.ruleVersionTag,
    sortOrder: item.sortOrder,
    explanation: {
      measureSummary: explanation.measureSummary,
      ruleCode: explanation.ruleCode,
      ruleVersionTag: explanation.ruleVersionTag,
      decisionPath: parseJsonArray(explanation.decisionPathJson),
      calculationSteps: parseJsonArray(explanation.calculationStepsJson),
      overrideSummary: explanation.overrideSummaryJson as string | null | undefined,
      humanReadableText: explanation.humanReadableText,
    },
  };
}

function decimalToNumber(value: Prisma.Decimal): number {
  return Number(value.toString());
}

function parseJsonArray<T>(value: Prisma.JsonValue): readonly T[] {
  if (Array.isArray(value)) {
    return value as T[];
  }
  return [];
}
