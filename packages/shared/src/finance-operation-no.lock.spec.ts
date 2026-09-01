/**
 * Çalıştır:
 *   node --experimental-strip-types --test packages/shared/src/finance-operation-no.lock.spec.ts
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { financeOperationNo, resolveClaimRevenueVat, shouldCreateApprovedFileFee } from './finance-operation-no.ts';

describe('finans işlem no + onay gelir kapısı', () => {
  it('masraf ve gelir no üretir', () => {
    assert.equal(
      financeOperationNo('MSF', '1707f8d5-6f76-4672-96c6-f92651399fe6', '2026-08-15'),
      'MSF-2026-399FE6',
    );
    assert.equal(
      financeOperationNo('GLR', 'aaaaaaaa-bbbb-cccc-dddd-eeeeffffffff', '2026-01-01'),
      'GLR-2026-FFFFFF',
    );
  });

  it('onaylı raporda dosya bedeli yoksa gelir kaydı açılır', () => {
    assert.equal(
      shouldCreateApprovedFileFee({
        hasFileFee: false,
        reportStatus: 'externally_approved',
        salesAmount: 32500,
      }),
      true,
    );
    assert.equal(
      shouldCreateApprovedFileFee({
        hasFileFee: true,
        reportStatus: 'approved',
        salesAmount: 32500,
      }),
      false,
    );
    assert.equal(
      shouldCreateApprovedFileFee({
        hasFileFee: false,
        reportStatus: 'draft',
        salesAmount: 32500,
      }),
      false,
    );
  });

  it('faturasız gelirde KDV sıfırlanır; tutar net kalır', () => {
    assert.deepEqual(
      resolveClaimRevenueVat({ billed: false, amount: 10000, vatRate: 20 }),
      { billed: false, vatRate: 0, vatAmount: 0, totalAmount: 10000 },
    );
    assert.deepEqual(
      resolveClaimRevenueVat({ billed: true, amount: 10000, vatRate: 20 }),
      { billed: true, vatRate: 20, vatAmount: 2000, totalAmount: 12000 },
    );
    assert.equal(resolveClaimRevenueVat({ amount: 5000, vatRate: 10 }).billed, true);
  });
});
