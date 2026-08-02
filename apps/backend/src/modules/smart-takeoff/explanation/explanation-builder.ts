import type { MeasureReadSnapshot } from '../ports/measure-read.port';
import type { PlannedOperationItem } from '../rule-engine/rule-result';
import type { CalculationResult } from '../calculation-engine/calculation-result';
import type {
  CalculationExplanationModel,
  ExplanationStep,
} from './calculation-explanation.model';

export function buildMeasureSummary(measure: MeasureReadSnapshot): string {
  const parts = [measure.structureElementType];
  if (measure.widthMm != null && measure.heightMm != null) {
    parts.push(`${measure.widthMm}×${measure.heightMm} mm`);
  } else if (measure.lengthMm != null) {
    parts.push(`${measure.lengthMm} mm`);
  }
  return parts.join(' · ');
}

export function buildExplanation(input: {
  measure: MeasureReadSnapshot;
  ruleCode: string;
  ruleVersionTag: string;
  decisionPath: readonly string[];
  item: PlannedOperationItem;
  calculation: CalculationResult;
}): CalculationExplanationModel {
  const measureSummary = buildMeasureSummary(input.measure);
  const steps: ExplanationStep[] = [
    {
      order: 0,
      label: 'Karar',
      input: { decisionPath: input.decisionPath },
      output: input.item.operationItemCode,
    },
    ...input.calculation.steps.map((s, i) => ({
      ...s,
      order: i + 1,
    })),
    {
      order: input.calculation.steps.length + 1,
      label: 'Operasyon İş Kalemi',
      input: {
        code: input.item.operationItemCode,
        displayName: input.item.displayName,
      },
      output: {
        quantityEngine: input.calculation.quantityEngine,
        unit: input.calculation.unit,
      },
    },
  ];

  const humanReadableText = [
    measureSummary,
    `Kural: ${input.ruleCode} (${input.ruleVersionTag})`,
    `Kalem: ${input.item.displayName}`,
    `Miktar: ${input.calculation.quantityEngine} ${input.calculation.unit}`,
  ].join(' → ');

  return {
    measureSummary,
    ruleCode: input.ruleCode,
    ruleVersionTag: input.ruleVersionTag,
    decisionPath: input.decisionPath,
    calculationSteps: steps,
    overrideSummary: null,
    humanReadableText,
  };
}
