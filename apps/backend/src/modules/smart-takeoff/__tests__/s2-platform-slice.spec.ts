import { CalculationEngine } from '../calculation-engine/calculation-engine';
import { DecisionEngine } from '../decision-engine/decision-engine';
import { InMemoryMeasureReadPort } from '../ports/measure-read.port';
import {
  IN_MEMORY_RULE_VERSION_ID,
  InMemoryTakeoffPersistAdapter,
} from '../adapters/in-memory-takeoff-persist.adapter';
import { mapSmElementTypeToTakeoff } from '../adapters/sm-structure-type.mapper';
import { OperationItemCodes, StructureElementTypes } from '../domain/domain.types';
import { TakeoffPipeline } from '../pipeline/takeoff-pipeline';
import { RuleEngine } from '../rule-engine/rule-engine';
import { RuleRegistry } from '../rule-engine/rule-registry';
import { registerS1Rules } from '../rule-library/register-s1-rules';
import { SmartTakeoffService } from '../smart-takeoff.service';
import { RuleVersionResolver } from '../versioning/rule-version-resolver';

function buildS2Service(
  measureRead = new InMemoryMeasureReadPort([
    {
      measureElementId: 'me-door',
      measureVersionId: 'mv-door',
      claimFileId: 'cf-1',
      structureElementType: StructureElementTypes.DOOR,
      widthMm: 2100,
      heightMm: 900,
    },
  ]),
  persist = new InMemoryTakeoffPersistAdapter(),
): SmartTakeoffService {
  const registry = new RuleRegistry();
  const ruleEngine = new RuleEngine(registry);
  const decisionEngine = new DecisionEngine(ruleEngine);
  const calculationEngine = new CalculationEngine();
  const pipeline = new TakeoffPipeline(decisionEngine, calculationEngine);
  const ruleVersionResolver = {
    resolveCurrent: jest.fn().mockResolvedValue({
      id: IN_MEMORY_RULE_VERSION_ID,
      versionTag: 's1.2026.08.02.1',
      librarySnapshotHash: 'test',
      effectiveFrom: new Date('2026-08-02'),
    }),
  } as unknown as RuleVersionResolver;
  const service = new SmartTakeoffService(
    registry,
    ruleEngine,
    decisionEngine,
    calculationEngine,
    pipeline,
    { findOne: jest.fn().mockResolvedValue({ id: 'cf-1' }) } as never,
    ruleVersionResolver,
    measureRead,
    persist,
  );
  service.ensureS1RulesLoaded();
  return service;
}

describe('S2 — SM adapter → pipeline → persist → readable line items', () => {
  it('maps SM element types to SQT structure types', () => {
    expect(mapSmElementTypeToTakeoff('kapi')).toBe(StructureElementTypes.DOOR);
    expect(mapSmElementTypeToTakeoff('pencere')).toBe(StructureElementTypes.WINDOW);
    expect(mapSmElementTypeToTakeoff('tavan')).toBe(StructureElementTypes.CEILING);
    expect(mapSmElementTypeToTakeoff('diger')).toBeNull();
  });

  it('createRun persists work items with readable display names', async () => {
    const persist = new InMemoryTakeoffPersistAdapter();
    const service = buildS2Service(undefined, persist);

    const run = await service.createRun(
      'cf-1',
      { id: 'user-1', roleCode: 'admin' },
      { note: 'S2 test' },
    );

    expect(run.runNumber).toBe(1);
    expect(run.ruleVersionTag).toBe('s1.2026.08.02.1');
    expect(run.lineItemCount).toBe(4);
    expect(run.lineItems[0].displayName).toBe('Kapı Macun');
    expect(run.lineItems[3].operationItemCode).toBe(OperationItemCodes.DOOR_PAINT_COAT);
    expect(run.lineItems[3].quantityFinal).toBe(3.78);
    expect(run.lineItems[3].explanation.humanReadableText).toContain('Kapı Boya');
  });

  it('listRuns and getRun return persisted data', async () => {
    const service = buildS2Service();
    const created = await service.createRun(
      'cf-1',
      { id: 'user-1', roleCode: 'admin' },
      {},
    );

    const list = await service.listRuns('cf-1', { id: 'user-1', roleCode: 'admin' });
    expect(list).toHaveLength(1);

    const detail = await service.getRun('cf-1', created.id, {
      id: 'user-1',
      roleCode: 'admin',
    });
    expect(detail.lineItems).toHaveLength(4);
  });

  it('S1 vertical slice still works unchanged', () => {
    const service = buildS2Service();
    const result = service.runVerticalSlice({
      measureElementId: 'me-1',
      measureVersionId: 'mv-1',
      claimFileId: 'cf-1',
      structureElementType: StructureElementTypes.DOOR,
      widthMm: 2100,
      heightMm: 900,
    });
    expect(result.workItems).toHaveLength(4);
    expect(result.workItems[0].structureElementType).toBe(StructureElementTypes.DOOR);
  });
});
