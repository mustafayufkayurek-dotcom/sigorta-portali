import { Injectable } from '@nestjs/common';
import type { TakeoffRule } from './rule.interface';

/**
 * In-memory Rule Registry (S0).
 * Rule count: 0 — Library content arrives in later sprints.
 */
@Injectable()
export class RuleRegistry {
  private readonly rules = new Map<string, TakeoffRule>();

  register(rule: TakeoffRule): void {
    this.rules.set(rule.code, rule);
  }

  getByCode(code: string): TakeoffRule | undefined {
    return this.rules.get(code);
  }

  listByStructureElementType(structureElementType: string): TakeoffRule[] {
    return [...this.rules.values()].filter(
      (r) => r.structureElementType === structureElementType,
    );
  }

  listAll(): TakeoffRule[] {
    return [...this.rules.values()];
  }

  count(): number {
    return this.rules.size;
  }

  clear(): void {
    this.rules.clear();
  }
}
