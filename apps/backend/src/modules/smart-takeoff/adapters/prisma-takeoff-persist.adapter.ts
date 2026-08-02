import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import type { CalculationExplanationModel } from '../explanation/calculation-explanation.model';
import type {
  ApplyLineItemOverrideInput,
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
      overrides: {
        orderBy: { createdAt: 'desc' as const },
      },
    },
  },
} satisfies Prisma.TakeoffRunInclude;

const LINE_ITEM_INCLUDE = {
  explanation: true,
  sources: true,
  rule: true,
  overrides: {
    orderBy: { createdAt: 'desc' as const },
  },
} satisfies Prisma.TakeoffLineItemInclude;

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

  async applyLineItemOverride(input: ApplyLineItemOverrideInput): Promise<PersistedTakeoffLineItem> {
    const lineItem = await this.prisma.takeoffLineItem.findFirst({
      where: {
        id: input.lineItemId,
        status: 'active',
        run: { id: input.runId, claimFileId: input.claimFileId },
      },
      include: LINE_ITEM_INCLUDE,
    });

    if (!lineItem) {
      throw new NotFoundException('İş kalemi bulunamadı');
    }

    const quantityEnginePreserved = lineItem.quantityEngine;
    const overrideSummary = buildOverrideSummary(
      decimalToNumber(quantityEnginePreserved),
      input.quantityOverride,
      input.reason,
    );

    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.takeoffManualOverride.updateMany({
        where: { takeoffLineItemId: input.lineItemId, active: true },
        data: { active: false },
      });

      await tx.takeoffManualOverride.create({
        data: {
          takeoffLineItemId: input.lineItemId,
          quantityEnginePreserved,
          quantityOverride: input.quantityOverride,
          reason: input.reason.trim(),
          createdByUserId: input.createdByUserId,
          active: true,
        },
      });

      return tx.takeoffLineItem.update({
        where: { id: input.lineItemId },
        data: {
          quantityFinal: input.quantityOverride,
          hasOverride: true,
          explanation: {
            update: {
              overrideSummaryJson: overrideSummary,
              humanReadableText: appendOverrideText(
                lineItem.explanation?.humanReadableText ?? '',
                overrideSummary,
              ),
            },
          },
        },
        include: LINE_ITEM_INCLUDE,
      });
    });

    return mapLineItem(updated);
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
  item: RunWithRelations['lineItems'][number] | Prisma.TakeoffLineItemGetPayload<{ include: typeof LINE_ITEM_INCLUDE }>,
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
    hasOverride: item.hasOverride,
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
    overrides: item.overrides.map((o) => ({
      id: o.id,
      quantityEnginePreserved: decimalToNumber(o.quantityEnginePreserved),
      quantityOverride: decimalToNumber(o.quantityOverride),
      reason: o.reason,
      createdByUserId: o.createdByUserId,
      createdAt: o.createdAt,
      active: o.active,
    })),
  };
}

function buildOverrideSummary(
  quantityEngine: number,
  quantityOverride: number,
  reason: string,
): string {
  return `${quantityEngine} → ${quantityOverride} (${reason.trim()})`;
}

function appendOverrideText(base: string, overrideSummary: string): string {
  const suffix = `Manuel düzeltme: ${overrideSummary}`;
  if (!base) return suffix;
  if (base.includes('Manuel düzeltme:')) return base;
  return `${base} · ${suffix}`;
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
