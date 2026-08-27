/**
 * Olumsuz memnuniyet/maliyet — 2. atamada yönetici raporu.
 * Çalıştır: node --experimental-strip-types --test packages/shared/src/acil-vendor-quality.lock.spec.ts
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  ACIL_NEGATIVE_VENDOR_STRIKE_LIMIT,
  isAcilVendorQualityWarning,
  shouldReportAcilNegativeVendorStrike,
} from './acil-vendor-quality.ts';

describe('acil tedarikçi kalite uyarısı LOCK', () => {
  it('hafızasız yeni tedarikçiyi olumsuz saymaz', () => {
    assert.equal(isAcilVendorQualityWarning({}), false);
    assert.equal(isAcilVendorQualityWarning({ compositeScore: 50, completedFileCount: 0 }), false);
  });

  it('düşük memnuniyet veya düşük bileşik skor olumsuzdur', () => {
    assert.equal(isAcilVendorQualityWarning({ avgServiceScore: 2.5 }), true);
    assert.equal(isAcilVendorQualityWarning({ compositeScore: 30, completedFileCount: 3 }), true);
    assert.equal(isAcilVendorQualityWarning({ avgServiceScore: 4.2, compositeScore: 70, completedFileCount: 5 }), false);
  });

  it('yönetici raporu 2. çalışmada tetiklenir', () => {
    assert.equal(ACIL_NEGATIVE_VENDOR_STRIKE_LIMIT, 2);
    assert.equal(shouldReportAcilNegativeVendorStrike(0), false);
    assert.equal(shouldReportAcilNegativeVendorStrike(1), true);
  });
});
