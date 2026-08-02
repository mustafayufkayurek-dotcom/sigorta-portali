import type { PersistedTakeoffLineItem, PersistedTakeoffRun } from '../ports/takeoff-persist.port';
import type {
  TakeoffLineItemResponseDto,
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

function toTakeoffLineItemResponse(item: PersistedTakeoffLineItem): TakeoffLineItemResponseDto {
  return {
    id: item.id,
    operationItemCode: item.operationItemCode,
    displayName: item.displayName,
    structureElementType: item.structureElementType,
    sourceMeasureElementId: item.sourceMeasureElementId,
    unit: item.unit,
    quantityEngine: item.quantityEngine,
    quantityFinal: item.quantityFinal,
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
    },
  };
}
