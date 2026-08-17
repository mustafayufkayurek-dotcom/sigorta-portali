import type { PersistedTakeoffLineItem, PersistedTakeoffRun } from '../ports/takeoff-persist.port';
import type {
  TakeoffLineItemResponseDto,
  TakeoffManualOverrideResponseDto,
  TakeoffRunResponseDto,
} from '../dto/takeoff-run.dto';

export function toTakeoffRunResponse(run: PersistedTakeoffRun): TakeoffRunResponseDto {
  return {
    id: run.id,
    claimFileId: run.claimFileId,
    runNumber: run.runNumber,
    ruleVersionTag: run.ruleVersionTag,
    status: run.status,
    note: run.note,
    createdAt: run.createdAt.toISOString(),
    lineItemCount: run.lineItems.length,
    lineItems: run.lineItems.map(toTakeoffLineItemResponse),
  };
}

export function toTakeoffLineItemResponse(item: PersistedTakeoffLineItem): TakeoffLineItemResponseDto {
  return {
    id: item.id,
    operationItemCode: item.operationItemCode,
    displayName: item.displayName,
    structureElementType: item.structureElementType,
    sourceMeasureElementId: item.sourceMeasureElementId,
    unit: item.unit,
    quantityEngine: item.quantityEngine,
    quantityFinal: item.quantityFinal,
    hasOverride: item.hasOverride,
    ruleCode: item.ruleCode,
    ruleVersionTag: item.ruleVersionTag,
    sortOrder: item.sortOrder,
    explanation: {
      measureSummary: item.explanation.measureSummary,
      humanReadableText: item.explanation.humanReadableText,
      decisionPath: [...item.explanation.decisionPath],
      calculationSteps: item.explanation.calculationSteps.map((s) => ({
        order: s.order,
        label: s.label,
        input: s.input,
        output: s.output,
      })),
      overrideSummary: item.explanation.overrideSummary ?? null,
    },
    overrides: item.overrides.map(toManualOverrideResponse),
  };
}

function toManualOverrideResponse(
  override: PersistedTakeoffLineItem['overrides'][number],
): TakeoffManualOverrideResponseDto {
  return {
    id: override.id,
    quantityEnginePreserved: override.quantityEnginePreserved,
    quantityOverride: override.quantityOverride,
    reason: override.reason,
    createdAt: override.createdAt.toISOString(),
    createdByUserId: override.createdByUserId,
    active: override.active,
  };
}
