import { BadRequestException, NotFoundException } from '@nestjs/common';
import { TAKEOFF_MAX_MEASURES_PER_RUN } from '../constants/takeoff-limits';
import { InMemoryTakeoffPersistAdapter } from '../adapters/in-memory-takeoff-persist.adapter';
import {
  buildManyDoorMeasures,
  buildMultiElementMeasures,
  buildS5Service,
  S5_CLAIM_FILE_ID,
  S5_USER,
} from './fixtures/s5-sm-fixtures';

describe('S5 — Takeoff run lifecycle (create → list → get → override)', () => {
  it('increments runNumber per claim file on each createRun', async () => {
    const persist = new InMemoryTakeoffPersistAdapter();
    const service = buildS5Service(buildMultiElementMeasures(), persist);

    const run1 = await service.createRun(S5_CLAIM_FILE_ID, S5_USER, { note: 'İlk koşum' });
    const run2 = await service.createRun(S5_CLAIM_FILE_ID, S5_USER, { note: 'İkinci koşum' });

    expect(run1.runNumber).toBe(1);
    expect(run2.runNumber).toBe(2);
    expect(run1.id).not.toBe(run2.id);
    expect(run1.lineItemCount).toBe(run2.lineItemCount);
  });

  it('re-run creates independent run; prior run unchanged (immutable)', async () => {
    const persist = new InMemoryTakeoffPersistAdapter();
    const service = buildS5Service(
      [
        {
          measureElementId: 'me-door',
          measureVersionId: 'mv-door',
          claimFileId: S5_CLAIM_FILE_ID,
          structureElementType: 'DOOR',
          widthMm: 2100,
          heightMm: 900,
        },
      ],
      persist,
    );

    const first = await service.createRun(S5_CLAIM_FILE_ID, S5_USER, {});
    await service.applyLineItemOverride(
      S5_CLAIM_FILE_ID,
      first.id,
      first.lineItems[0].id,
      S5_USER,
      { quantityOverride: 99, reason: 'İlk koşum düzeltmesi' },
    );

    const second = await service.createRun(S5_CLAIM_FILE_ID, S5_USER, {});

    const firstDetail = await service.getRun(S5_CLAIM_FILE_ID, first.id, S5_USER);
    const secondDetail = await service.getRun(S5_CLAIM_FILE_ID, second.id, S5_USER);

    expect(firstDetail.lineItems[0].hasOverride).toBe(true);
    expect(firstDetail.lineItems[0].quantityFinal).toBe(99);
    expect(secondDetail.lineItems[0].hasOverride).toBe(false);
    expect(secondDetail.runNumber).toBe(2);
  });

  it('listRuns returns runs in descending runNumber order', async () => {
    const service = buildS5Service(buildMultiElementMeasures());

    await service.createRun(S5_CLAIM_FILE_ID, S5_USER, { note: 'A' });
    await service.createRun(S5_CLAIM_FILE_ID, S5_USER, { note: 'B' });
    await service.createRun(S5_CLAIM_FILE_ID, S5_USER, { note: 'C' });

    const list = await service.listRuns(S5_CLAIM_FILE_ID, S5_USER);
    expect(list).toHaveLength(3);
    expect(list.map((r) => r.runNumber)).toEqual([3, 2, 1]);
  });

  it('getRun returns full line items with explanation for audit', async () => {
    const service = buildS5Service(buildMultiElementMeasures());
    const created = await service.createRun(S5_CLAIM_FILE_ID, S5_USER, {
      note: 'Audit test',
    });

    const detail = await service.getRun(S5_CLAIM_FILE_ID, created.id, S5_USER);

    expect(detail.note).toBe('Audit test');
    expect(detail.ruleVersionTag).toBe('s1.2026.08.02.1');
    expect(detail.lineItems.length).toBeGreaterThan(0);
    expect(detail.lineItems[0].explanation.decisionPath.length).toBeGreaterThan(0);
    expect(detail.lineItems[0].explanation.calculationSteps.length).toBeGreaterThan(0);
  });

  it('getRun throws NotFoundException for unknown runId', async () => {
    const service = buildS5Service(buildMultiElementMeasures());

    await expect(
      service.getRun(S5_CLAIM_FILE_ID, 'missing-run-id', S5_USER),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('createRun preserves ruleVersionTag from resolver (platform memory)', async () => {
    const service = buildS5Service(buildMultiElementMeasures());
    const run = await service.createRun(S5_CLAIM_FILE_ID, S5_USER, {});

    expect(run.ruleVersionTag).toBe('s1.2026.08.02.1');
    run.lineItems.forEach((li) => {
      expect(li.ruleVersionTag).toBe('s1.2026.08.02.1');
      expect(li.sourceMeasureElementId).toBeTruthy();
    });
  });

  it('rejects createRun when measure count exceeds batch limit', async () => {
    const overLimit = TAKEOFF_MAX_MEASURES_PER_RUN + 1;
    const service = buildS5Service(buildManyDoorMeasures(overLimit));

    await expect(service.createRun(S5_CLAIM_FILE_ID, S5_USER, {})).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('status remains active on created runs (no silent transition)', async () => {
    const service = buildS5Service(buildMultiElementMeasures());
    const run = await service.createRun(S5_CLAIM_FILE_ID, S5_USER, {});

    expect(run.status).toBe('active');
  });
});
