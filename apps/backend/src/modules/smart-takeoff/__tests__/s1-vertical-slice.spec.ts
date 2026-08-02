import { CalculationEngine } from '../calculation-engine/calculation-engine';
import { DecisionEngine } from '../decision-engine/decision-engine';
import { OperationItemCodes, StructureElementTypes } from '../domain/domain.types';
import { TakeoffPipeline } from '../pipeline/takeoff-pipeline';
import type { MeasureReadSnapshot } from '../ports/measure-read.port';
import { RuleEngine } from '../rule-engine/rule-engine';
import { RuleRegistry } from '../rule-engine/rule-registry';
import { registerS1Rules } from '../rule-library/register-s1-rules';
import { S1_RULE_DEFINITIONS } from '../rule-library/s1-rule-definitions';
import { InMemoryTakeoffPersistAdapter } from '../adapters/in-memory-takeoff-persist.adapter';
import { InMemoryMeasureReadPort } from '../ports/measure-read.port';
import { SmartTakeoffService } from '../smart-takeoff.service';

function buildService(): SmartTakeoffService {
  const registry = new RuleRegistry();
  const ruleEngine = new RuleEngine(registry);
  const decisionEngine = new DecisionEngine(ruleEngine);
  const calculationEngine = new CalculationEngine();
  const pipeline = new TakeoffPipeline(decisionEngine, calculationEngine);
  const persist = new InMemoryTakeoffPersistAdapter();
  const measureRead = new InMemoryMeasureReadPort();
  const service = new SmartTakeoffService(
    registry,
    ruleEngine,
    decisionEngine,
    calculationEngine,
    pipeline,
    { findOne: jest.fn() } as never,
    measureRead,
    persist,
  );
  service.ensureS1RulesLoaded();
  return service;
}

function measure(partial: Partial<MeasureReadSnapshot> & Pick<MeasureReadSnapshot, 'structureElementType'>): MeasureReadSnapshot {
  return {
    measureElementId: partial.measureElementId ?? 'me-1',
    measureVersionId: partial.measureVersionId ?? 'mv-1',
    claimFileId: partial.claimFileId ?? 'cf-1',
    structureElementType: partial.structureElementType,
    widthMm: partial.widthMm,
    heightMm: partial.heightMm,
    lengthMm: partial.lengthMm,
  };
}

describe('S1 vertical slice — SM → Rule → Decision → Calc → Work Item → Explanation', () => {
  const service = buildService();

  it('registers exactly 4 S1 rules (no library bloat)', () => {
    expect(S1_RULE_DEFINITIONS).toHaveLength(4);
    expect(service.getSkeletonStatus().ruleCount).toBe(4);
  });

  it('DOOR 2100×900 → Macun/Astar/Zımpara/Boya with explainable quantities', () => {
    const result = service.runVerticalSlice(
      measure({
        structureElementType: StructureElementTypes.DOOR,
        widthMm: 2100,
        heightMm: 900,
      }),
    );

    expect(result.decisionPath).toEqual(['DOOR_PAINTING_SET']);
    expect(result.workItems).toHaveLength(4);
    expect(result.workItems.map((w) => w.operationItemCode)).toEqual([
      OperationItemCodes.DOOR_PUTTY,
      OperationItemCodes.DOOR_PRIMER,
      OperationItemCodes.DOOR_SANDING,
      OperationItemCodes.DOOR_PAINT_COAT,
    ]);
    expect(result.workItems[0].quantityEngine).toBe(1.89);
    expect(result.workItems[3].quantityEngine).toBe(3.78);
    expect(result.workItems[3].explanation.calculationSteps.length).toBeGreaterThan(2);
    expect(result.workItems[3].explanation.humanReadableText).toContain('Kapı Boya');
    expect(result.workItems[3].quantityFinal).toBe(result.workItems[3].quantityEngine);
  });

  it('WINDOW → Astar + Boya', () => {
    const result = service.runVerticalSlice(
      measure({
        structureElementType: StructureElementTypes.WINDOW,
        widthMm: 1200,
        heightMm: 1400,
      }),
    );
    expect(result.decisionPath).toEqual(['WINDOW_PAINTING_SET']);
    expect(result.workItems).toHaveLength(2);
    expect(result.workItems[0].quantityEngine).toBe(1.68);
    expect(result.workItems[1].quantityEngine).toBe(3.36);
  });

  it('SKIRTING → length m.tül', () => {
    const result = service.runVerticalSlice(
      measure({
        structureElementType: StructureElementTypes.SKIRTING,
        lengthMm: 4500,
      }),
    );
    expect(result.decisionPath).toEqual(['SKIRTING_INSTALL_SET']);
    expect(result.workItems).toHaveLength(1);
    expect(result.workItems[0].operationItemCode).toBe(OperationItemCodes.SKIRTING_INSTALL);
    expect(result.workItems[0].unit).toBe('m_tul');
    expect(result.workItems[0].quantityEngine).toBe(4.5);
  });

  it('CEILING → Astar + Boya', () => {
    const result = service.runVerticalSlice(
      measure({
        structureElementType: StructureElementTypes.CEILING,
        widthMm: 4000,
        heightMm: 3000,
      }),
    );
    expect(result.decisionPath).toEqual(['CEILING_PAINTING_SET']);
    expect(result.workItems).toHaveLength(2);
    expect(result.workItems[0].quantityEngine).toBe(12);
    expect(result.workItems[1].quantityEngine).toBe(24);
  });

  it('missing dimensions → no invented work items', () => {
    const result = service.runVerticalSlice(
      measure({ structureElementType: StructureElementTypes.DOOR }),
    );
    expect(result.workItems).toHaveLength(0);
    expect(result.decisionPath).toEqual(['no_matching_rule']);
  });

  it('unsupported element → empty plan (no scope creep)', () => {
    const result = service.runVerticalSlice(
      measure({
        structureElementType: 'PARQUET',
        widthMm: 3000,
        heightMm: 4000,
      }),
    );
    expect(result.workItems).toHaveLength(0);
  });

  it('Decision does not call Calculation for item selection (layer separation smoke)', () => {
    const registry = new RuleRegistry();
    registerS1Rules(registry);
    const ruleEngine = new RuleEngine(registry);
    const decision = new DecisionEngine(ruleEngine);
    const plan = decision.plan({
      claimFileId: 'cf-1',
      ruleVersionTag: 's1.test',
      measure: measure({
        structureElementType: StructureElementTypes.DOOR,
        widthMm: 2100,
        heightMm: 900,
      }),
    });
    expect(plan.plannedItems.every((i) => typeof i.calculationKey === 'string')).toBe(true);
    expect(plan.plannedItems.every((i) => !('quantityEngine' in i))).toBe(true);
  });
});
