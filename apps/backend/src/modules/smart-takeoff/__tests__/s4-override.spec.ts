import { BadRequestException, NotFoundException } from '@nestjs/common';
import { CalculationEngine } from '../calculation-engine/calculation-engine';
import { DecisionEngine } from '../decision-engine/decision-engine';
import {
  IN_MEMORY_RULE_VERSION_ID,
  InMemoryTakeoffPersistAdapter,
} from '../adapters/in-memory-takeoff-persist.adapter';
import { InMemoryMeasureReadPort } from '../ports/measure-read.port';
import { StructureElementTypes } from '../domain/domain.types';
import { TakeoffPipeline } from '../pipeline/takeoff-pipeline';
import { RuleEngine } from '../rule-engine/rule-engine';
import { RuleRegistry } from '../rule-engine/rule-registry';
import { registerS1Rules } from '../rule-library/register-s1-rules';
import { SmartTakeoffService } from '../smart-takeoff.service';
import { RuleVersionResolver } from '../versioning/rule-version-resolver';

function buildS4Service(persist = new InMemoryTakeoffPersistAdapter()): SmartTakeoffService {
  const registry = new RuleRegistry();
  registerS1Rules(registry);
  const ruleEngine = new RuleEngine(registry);
  const decisionEngine = new DecisionEngine(ruleEngine);
  const calculationEngine = new CalculationEngine();
  const pipeline = new TakeoffPipeline(decisionEngine, calculationEngine);
  const measureRead = new InMemoryMeasureReadPort([
    {
      measureElementId: 'me-door',
      measureVersionId: 'mv-door',
      claimFileId: 'cf-1',
      structureElementType: StructureElementTypes.DOOR,
      widthMm: 2100,
      heightMm: 900,
    },
  ]);
  const ruleVersionResolver = {
    resolveCurrent: jest.fn().mockResolvedValue({
      id: IN_MEMORY_RULE_VERSION_ID,
      versionTag: 's1.2026.08.02.1',
      librarySnapshotHash: 'test',
      effectiveFrom: new Date('2026-08-02'),
    }),
  } as unknown as RuleVersionResolver;

  return new SmartTakeoffService(
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
}

describe('S4 — Manual override API', () => {
  it('applyLineItemOverride updates quantityFinal and preserves quantityEngine', async () => {
    const persist = new InMemoryTakeoffPersistAdapter();
    const service = buildS4Service(persist);

    const run = await service.createRun(
      'cf-1',
      { id: 'user-1', roleCode: 'admin' },
      { note: 'S4 override test' },
    );

    const target = run.lineItems[0];
    const engineQty = target.quantityEngine;

    const updated = await service.applyLineItemOverride(
      'cf-1',
      run.id,
      target.id,
      { id: 'user-1', roleCode: 'admin' },
      { quantityOverride: 2.5, reason: 'Saha ölçümü farklı' },
    );

    expect(updated.quantityEngine).toBe(engineQty);
    expect(updated.quantityFinal).toBe(2.5);
    expect(updated.hasOverride).toBe(true);
    expect(updated.overrides).toHaveLength(1);
    expect(updated.overrides[0].active).toBe(true);
    expect(updated.overrides[0].reason).toBe('Saha ölçümü farklı');
    expect(updated.explanation.overrideSummary).toContain('2.5');
  });

  it('deactivates previous override on re-apply', async () => {
    const service = buildS4Service();
    const run = await service.createRun(
      'cf-1',
      { id: 'user-1', roleCode: 'admin' },
      {},
    );
    const target = run.lineItems[0];

    await service.applyLineItemOverride(
      'cf-1',
      run.id,
      target.id,
      { id: 'user-1', roleCode: 'admin' },
      { quantityOverride: 2.0, reason: 'İlk düzeltme' },
    );

    const second = await service.applyLineItemOverride(
      'cf-1',
      run.id,
      target.id,
      { id: 'user-2', roleCode: 'admin' },
      { quantityOverride: 2.2, reason: 'İkinci düzeltme' },
    );

    expect(second.quantityFinal).toBe(2.2);
    expect(second.overrides.filter((o) => o.active)).toHaveLength(1);
    expect(second.overrides.filter((o) => !o.active)).toHaveLength(1);
  });

  it('getRun reflects override without mutating rule version', async () => {
    const service = buildS4Service();
    const run = await service.createRun(
      'cf-1',
      { id: 'user-1', roleCode: 'admin' },
      {},
    );
    const ruleVersionTag = run.ruleVersionTag;

    await service.applyLineItemOverride(
      'cf-1',
      run.id,
      run.lineItems[0].id,
      { id: 'user-1', roleCode: 'admin' },
      { quantityOverride: 3.0, reason: 'Onaylı düzeltme' },
    );

    const detail = await service.getRun('cf-1', run.id, {
      id: 'user-1',
      roleCode: 'admin',
    });

    expect(detail.ruleVersionTag).toBe(ruleVersionTag);
    expect(detail.lineItems[0].hasOverride).toBe(true);
    expect(detail.lineItems[0].quantityFinal).toBe(3.0);
  });

  it('rejects empty reason', async () => {
    const service = buildS4Service();
    const run = await service.createRun(
      'cf-1',
      { id: 'user-1', roleCode: 'admin' },
      {},
    );

    await expect(
      service.applyLineItemOverride(
        'cf-1',
        run.id,
        run.lineItems[0].id,
        { id: 'user-1', roleCode: 'admin' },
        { quantityOverride: 2.0, reason: '   ' },
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects unknown line item', async () => {
    const service = buildS4Service();
    const run = await service.createRun(
      'cf-1',
      { id: 'user-1', roleCode: 'admin' },
      {},
    );

    await expect(
      service.applyLineItemOverride(
        'cf-1',
        run.id,
        'missing-line-item',
        { id: 'user-1', roleCode: 'admin' },
        { quantityOverride: 2.0, reason: 'Test' },
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
