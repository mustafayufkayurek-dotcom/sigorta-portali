import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { vendorPaidFromOutgoingStatuses } from './file-vendor-pay.ts';

describe('tedarikçi ödeme durumu', () => {
  it('kayıt yok / ödendi / ödenmedi', () => {
    assert.equal(vendorPaidFromOutgoingStatuses([]), null);
    assert.equal(vendorPaidFromOutgoingStatuses(['cancelled']), null);
    assert.equal(vendorPaidFromOutgoingStatuses(['completed']), true);
    assert.equal(vendorPaidFromOutgoingStatuses(['completed', 'completed']), true);
    assert.equal(vendorPaidFromOutgoingStatuses(['pending']), false);
    assert.equal(vendorPaidFromOutgoingStatuses(['completed', 'pending']), false);
  });
});
