/**
 * Kilit: TL noktalı binlik; alış/satış kâr yüzdesi.
 * Çalıştır: node --experimental-strip-types --test apps/web/src/utils/format-try-amount.lock.spec.ts
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { calcAlisSatisKar, formatTryAmount, parseTrAmount } from './format-try-amount.ts';

describe('TL biçim LOCK', () => {
  it('binlik nokta ve TL soneki', () => {
    assert.equal(formatTryAmount(1350, { fractionDigits: 0 }), '1.350 TL');
    assert.equal(formatTryAmount(950, { fractionDigits: 0 }), '950 TL');
    assert.equal(parseTrAmount('1.350'), 1350);
    assert.equal(parseTrAmount('950 TL'), 950);
  });

  it('kâr yüzdesi alışa göre', () => {
    const r = calcAlisSatisKar('950', '1.350');
    assert.ok(r);
    assert.equal(r.kar, 400);
    assert.ok(Math.abs(r.pct - 42.105) < 0.02);
  });
});
