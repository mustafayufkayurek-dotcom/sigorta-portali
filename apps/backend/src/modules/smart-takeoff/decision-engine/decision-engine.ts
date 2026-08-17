import { Injectable } from '@nestjs/common';
import type { RuleContext } from '../rule-engine/rule-context';
import { RuleEngine } from '../rule-engine/rule-engine';
import type { DecisionEnginePort, DecisionPlan } from './decision-engine.interface';

/**
 * Decision Engine — decides WHICH operation items are produced.
 * Consumes Rule Library via Rule Engine; never performs geometric math.
 */
@Injectable()
export class DecisionEngine implements DecisionEnginePort {
  constructor(private readonly ruleEngine: RuleEngine) {}

  plan(context: RuleContext): DecisionPlan {
    const results = this.ruleEngine.evaluateAll(context);
    const matched = results.filter((r) => r.matched);
    const plannedItems = matched.flatMap((r) => r.plannedItems);
    const decisionPath =
      matched.length > 0
        ? matched.map((r) => r.ruleCode)
        : ['no_matching_rule'];

    return {
      structureElementType: context.measure.structureElementType,
      ruleVersionTag: context.ruleVersionTag,
      plannedItems,
      decisionPath,
    };
  }
}
