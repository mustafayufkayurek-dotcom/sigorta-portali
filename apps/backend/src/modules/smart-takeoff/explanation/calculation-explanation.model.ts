/**
 * Explainable Calculation model.
 * Persistence deferred — structure + builder for S1 vertical slice.
 */

export interface ExplanationStep {
  readonly order: number;
  readonly label: string;
  readonly input?: unknown;
  readonly output?: unknown;
}

export interface CalculationExplanationModel {
  readonly measureSummary: string;
  readonly ruleCode: string;
  readonly ruleVersionTag: string;
  readonly decisionPath: readonly string[];
  readonly calculationSteps: readonly ExplanationStep[];
  readonly overrideSummary?: string | null;
  readonly humanReadableText: string;
}

export function emptyExplanation(
  partial?: Partial<CalculationExplanationModel>,
): CalculationExplanationModel {
  return {
    measureSummary: partial?.measureSummary ?? '',
    ruleCode: partial?.ruleCode ?? '',
    ruleVersionTag: partial?.ruleVersionTag ?? '',
    decisionPath: partial?.decisionPath ?? [],
    calculationSteps: partial?.calculationSteps ?? [],
    overrideSummary: partial?.overrideSummary ?? null,
    humanReadableText: partial?.humanReadableText ?? '',
  };
}
