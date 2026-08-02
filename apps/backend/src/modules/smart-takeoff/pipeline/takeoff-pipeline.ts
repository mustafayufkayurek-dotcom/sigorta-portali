import { Injectable } from '@nestjs/common';
import { CalculationEngine } from '../calculation-engine/calculation-engine';
import { DecisionEngine } from '../decision-engine/decision-engine';
import type { OperationWorkItem } from '../domain/operation-work-item';
import { buildExplanation } from '../explanation/explanation-builder';
import type { MeasureReadSnapshot } from '../ports/measure-read.port';
import type { RuleContext } from '../rule-engine/rule-context';
import { S1_RULE_VERSION_TAG } from '../rule-library/s1-rule-definitions';

export interface TakeoffPipelineResult {
  readonly structureElementType: string;
  readonly ruleVersionTag: string;
  readonly decisionPath: readonly string[];
  readonly workItems: readonly OperationWorkItem[];
}

/**
 * Vertical slice orchestrator:
 * Measure → Rule Engine → Decision → Calculation → Operation Work Item → Explanation
 *
 * Layers stay separate; this class only wires the chain.
 */
@Injectable()
export class TakeoffPipeline {
  constructor(
    private readonly decisionEngine: DecisionEngine,
    private readonly calculationEngine: CalculationEngine,
  ) {}

  runFromMeasure(
    measure: MeasureReadSnapshot,
    ruleVersionTag: string = S1_RULE_VERSION_TAG,
  ): TakeoffPipelineResult {
    const context: RuleContext = {
      claimFileId: measure.claimFileId,
      ruleVersionTag,
      measure,
    };

    const plan = this.decisionEngine.plan(context);
    const ruleCode = plan.decisionPath[0] ?? 'unknown';

    const workItems: OperationWorkItem[] = plan.plannedItems.map((item) => {
      const calculation = this.calculationEngine.computeForItem(item, measure);
      const explanation = buildExplanation({
        measure,
        ruleCode,
        ruleVersionTag: plan.ruleVersionTag,
        decisionPath: plan.decisionPath,
        item,
        calculation,
      });

      return {
        operationItemCode: item.operationItemCode,
        displayName: item.displayName,
        unit: item.unit,
        quantityEngine: calculation.quantityEngine,
        quantityFinal: calculation.quantityEngine,
        structureElementType: plan.structureElementType,
        sourceMeasureElementId: measure.measureElementId,
        sourceMeasureVersionId: measure.measureVersionId,
        ruleCode,
        ruleVersionTag: plan.ruleVersionTag,
        decisionPath: plan.decisionPath,
        explanation,
      };
    });

    return {
      structureElementType: plan.structureElementType,
      ruleVersionTag: plan.ruleVersionTag,
      decisionPath: plan.decisionPath,
      workItems,
    };
  }
}
