/**
 * Tedarikçi kimliği: şahıs T.C. zorunlu değil; sözleşme türe göre basar.
 * Çalıştır: node --experimental-strip-types --test packages/shared/src/vendor-identity.lock.spec.ts
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  normalizeVendorIdentityForSave,
  vendorContractIdentityMissing,
  vendorContractIdentityPrintLine,
  vendorUniqueIdentityConflictMessage,
  VENDOR_TC_KIMLIK_BLANK,
  VENDOR_VERGI_NO_BLANK,
} from './vendor-identity.ts';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '../../..');

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

  it('aynı T.C. / vergi ile ikinci kayıt personel dilinde kesilir; ham Prisma yok', () => {
    assert.match(
      vendorUniqueIdentityConflictMessage({
        field: 'identity_no',
        existingName: 'Enis Yalçın',
      }),
      /Enis Yalçın/,
    );
    assert.match(
      vendorUniqueIdentityConflictMessage({ field: 'tax_number' }),
      /Vergi No/,
    );
    assert.equal(normalizeVendorIdentityForSave(''), null);
    assert.equal(normalizeVendorIdentityForSave('  '), null);
    assert.equal(normalizeVendorIdentityForSave('10000000146'), '10000000146');

    const service = readFileSync(
      join(root, 'apps/backend/src/modules/vendors/vendors.service.ts'),
      'utf8',
    );
    const controller = readFileSync(
      join(root, 'apps/backend/src/modules/vendors/vendors.controller.ts'),
      'utf8',
    );
    const page = readFileSync(
      join(root, 'apps/web/src/app/panel/tedarikciler/page.tsx'),
      'utf8',
    );
    assert.match(service, /assertVendorIdentityUnique|vendorUniqueIdentityConflictMessage/);
    assert.match(service, /normalizeVendorIdentityForSave/);
    assert.match(service, /P2002/);
    assert.match(service, /ConflictException/);
    assert.match(controller, /@Query\('tc'\)/);
    assert.match(controller, /@Query\('taxNumber'\)/);
    assert.match(page, /handleIdentityDuplicateCheck/);
    assert.match(page, /vendors\/check-duplicate/);
    assert.match(page, /\{ tc: digits \}/);
    assert.match(page, /aynı kimlikle ikinci tedarikçi açılamaz/i);
  });
});
