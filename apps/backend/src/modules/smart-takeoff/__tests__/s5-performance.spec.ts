import { TAKEOFF_PERFORMANCE_WARN_MS } from '../constants/takeoff-limits';
import { OperationItemCodes } from '../domain/domain.types';
import {
  buildManyDoorMeasures,
  buildS5Service,
  S5_CLAIM_FILE_ID,
  S5_USER,
} from './fixtures/s5-sm-fixtures';

describe('S5 — Performance / large claim file behavior', () => {
  const PERF_COUNTS = [50, 100] as const;

  it.each(PERF_COUNTS)(
    'processes %i door elements within acceptable pipeline time',
    async (count) => {
      const service = buildS5Service(buildManyDoorMeasures(count));
      const started = Date.now();

      const run = await service.createRun(S5_CLAIM_FILE_ID, S5_USER, {
        note: `Perf ${count}`,
      });

      const elapsedMs = Date.now() - started;

      expect(run.lineItemCount).toBe(count * 4);
      expect(run.lineItems[0].operationItemCode).toBe(OperationItemCodes.DOOR_PUTTY);
      expect(elapsedMs).toBeLessThan(TAKEOFF_PERFORMANCE_WARN_MS);
    },
  );

  it('listRuns stays fast after multiple large runs', async () => {
    const service = buildS5Service(buildManyDoorMeasures(50));

    for (let i = 0; i < 3; i++) {
      await service.createRun(S5_CLAIM_FILE_ID, S5_USER, { note: `Batch ${i}` });
    }

    const started = Date.now();
    const list = await service.listRuns(S5_CLAIM_FILE_ID, S5_USER);
    const elapsedMs = Date.now() - started;

    expect(list).toHaveLength(3);
    expect(elapsedMs).toBeLessThan(500);
  });
});
