import { RuleFactory } from '../rule-engine/rule-factory';
import type { RuleRegistry } from '../rule-engine/rule-registry';
import { S1_RULE_DEFINITIONS } from './s1-rule-definitions';

/** Loads S1 Rule Library into registry. Idempotent clear+register for tests. */
export function registerS1Rules(registry: RuleRegistry): void {
  registry.clear();
  for (const rule of RuleFactory.fromDefinitions(S1_RULE_DEFINITIONS)) {
    registry.register(rule);
  }
}
