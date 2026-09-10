/**
 * Tedarikçi kimliği: şahıs T.C. zorunlu değil; sözleşme türe göre basar.
 * Çalıştır: node --experimental-strip-types --test packages/shared/src/vendor-identity.lock.spec.ts
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  vendorContractIdentityMissing,
  vendorContractIdentityPrintLine,
  VENDOR_TC_KIMLIK_BLANK,
  VENDOR_VERGI_NO_BLANK,
} from './vendor-identity.ts';

describe('tedarikçi kimlik LOCK', () => {
  it('şahısta T.C. zorunlu değildir; şirkette vergi zorunludur', () => {
    assert.equal(vendorContractIdentityMissing({ entityType: 'individual', identityNo: null }), false);
    assert.equal(vendorContractIdentityMissing({ entityType: 'corporate', taxNumber: null }), true);
    assert.equal(vendorContractIdentityMissing({ entityType: 'corporate', taxNumber: '1234567890' }), false);
  });

  it('sözleşme şirkette Vergi No, şahısta T.C. Kimlik No basar; boşsa nokta durur', () => {
    assert.equal(
      vendorContractIdentityPrintLine({ entityType: 'corporate', taxNumber: '1234567890' }),
      'Vergi No 1234567890',
    );
    assert.equal(
      vendorContractIdentityPrintLine({ entityType: 'corporate', taxNumber: '' }),
      `Vergi No ${VENDOR_VERGI_NO_BLANK}`,
    );
    assert.equal(
      vendorContractIdentityPrintLine({ entityType: 'individual', identityNo: '10000000146' }),
      'T.C. Kimlik No 10000000146',
    );
    assert.equal(
      vendorContractIdentityPrintLine({ entityType: 'individual', identityNo: null }),
      `T.C. Kimlik No ${VENDOR_TC_KIMLIK_BLANK}`,
    );
  });
});
