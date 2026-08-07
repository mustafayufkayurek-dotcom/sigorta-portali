import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  approvalBudgetReady,
  latestPriceFromChangeLog,
  resolveAcilBudgetAmounts,
  type AcilPriceChangeLogEntry,
} from './acil-budget-resolve';

function logEntry(
  field: 'alis' | 'satis',
  newValue: number,
  at = '2026-08-07T12:36:00.000Z',
): AcilPriceChangeLogEntry {
  return { at, field, oldValue: null, newValue };
}

describe('acil-budget-resolve', () => {
  it('backend maliyet kaydı yokken priceChangeLog’dan alış/satış geri yükler', () => {
    const priceChangeLog = [logEntry('satis', 3200), logEntry('alis', 2000)];
    const resolved = resolveAcilBudgetAmounts({ costs: [], priceChangeLog });
    assert.equal(resolved.alis, 2000);
    assert.equal(resolved.satis, 3200);
    assert.equal(latestPriceFromChangeLog(priceChangeLog, 'alis'), 2000);
  });

  it('backend maliyet kaydı varsa local günlüğü ezmez', () => {
    const resolved = resolveAcilBudgetAmounts({
      costs: [
        { entryType: 'gider', amount: 2100 },
        { entryType: 'gelir', amount: 3300 },
      ],
      priceChangeLog: [logEntry('satis', 3200), logEntry('alis', 2000)],
    });
    assert.equal(resolved.alis, 2100);
    assert.equal(resolved.satis, 3300);
  });

  it('onay talebi için alış+satış zorunlu (operasyon)', () => {
    assert.deepEqual(
      approvalBudgetReady({ alis: 2000, satis: 3200, requireAlis: true }),
      { ok: true },
    );
    assert.deepEqual(
      approvalBudgetReady({ alis: null, satis: 3200, requireAlis: true }),
      { ok: false, missing: 'alis' },
    );
    assert.deepEqual(
      approvalBudgetReady({ alis: 2000, satis: null, requireAlis: true }),
      { ok: false, missing: 'satis' },
    );
  });
});
