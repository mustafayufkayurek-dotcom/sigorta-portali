import type { MeasureReadSnapshot } from '../ports/measure-read.port';
import type { RuleDefinition } from '../rule-library/s1-rule-definitions';
import type { TakeoffRule } from './rule.interface';
import type { RuleContext } from './rule-context';
import type { RuleResult } from './rule-result';

/**
 * Hydrates declarative Rule Library definitions into TakeoffRule instances.
 * Reusable: any Capability can supply RuleDefinition[] without Nest coupling.
 */
export class RuleFactory {
  static fromDefinitions(definitions: readonly RuleDefinition[]): TakeoffRule[] {
    return definitions.map((def) => createRuleFromDefinition(def));
  }

  /** @deprecated S0 placeholder name — use fromDefinitions. */
  static fromLibrarySnapshot(snapshot: unknown): TakeoffRule[] {
    if (!Array.isArray(snapshot)) return [];
    return RuleFactory.fromDefinitions(snapshot as RuleDefinition[]);
  }
}

function createRuleFromDefinition(def: RuleDefinition): TakeoffRule {
  return {
    code: def.code,
    structureElementType: def.structureElementType,
    evaluate(context: RuleContext): RuleResult {
      if (context.measure.structureElementType !== def.structureElementType) {
        return { matched: false, ruleCode: def.code, plannedItems: [] };
      }
      if (!hasRequiredDimensions(context.measure, def.requiredDimensions)) {
        return {
          matched: false,
          ruleCode: def.code,
          plannedItems: [],
          notes: [`Eksik ölçü: ${def.requiredDimensions.join(', ')}`],
        };
      }
      return {
        matched: true,
        ruleCode: def.code,
        plannedItems: def.plannedItems,
      };
    },
  };
}

function hasRequiredDimensions(
  measure: MeasureReadSnapshot,
  required: readonly ('widthMm' | 'heightMm' | 'lengthMm')[],
): boolean {
  return required.every((key) => {
    const v = measure[key];
    return typeof v === 'number' && Number.isFinite(v) && v > 0;
  });
}
