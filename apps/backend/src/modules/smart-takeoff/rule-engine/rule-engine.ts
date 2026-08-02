import { Injectable } from '@nestjs/common';
import { RuleRegistry } from './rule-registry';
import type { RuleContext } from './rule-context';
import type { RuleResult } from './rule-result';

/**
 * Rule Engine orchestrator.
 * Coordinates registry lookup only — does not decide operation items (Decision Engine)
 * and does not perform math (Calculation Engine).
 */
@Injectable()
export class RuleEngine {
  constructor(private readonly registry: RuleRegistry) {}

  resolveCandidates(structureElementType: string): ReturnType<RuleRegistry['listByStructureElementType']> {
    return this.registry.listByStructureElementType(structureElementType);
  }

  evaluateAll(context: RuleContext): RuleResult[] {
    const candidates = this.resolveCandidates(context.measure.structureElementType);
    return candidates.map((rule) => rule.evaluate(context));
  }
}
