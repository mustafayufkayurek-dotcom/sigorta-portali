/**
 * Kilit: tek tedarikçi sözleşmesi; dosya sorumlusu metni değiştirmez.
 * Çalıştır: node --experimental-strip-types --test packages/shared/src/hasar-vendor-contract-kind.lock.spec.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  hasarVendorContractKindLabel,
  isVendorContractManagerRole,
  readVendorContractCorrectionRequest,
  readVendorContractKind,
  resolveHasarVendorContractKind,
  unwrapVendorContractWorkItems,
  wrapVendorContractWorkItems,
} from './hasar-vendor-contract-kind.ts';
import {
  extractIdentityCandidatesFromText,
  isValidTcKimlikNo,
  vendorContractIdentityMissing,
} from './vendor-identity.ts';

const here = dirname(fileURLToPath(import.meta.url));

describe('hasar tedarikçi sözleşme türü LOCK', () => {
  it('eşik yok; her tutarda tam sözleşme', () => {
    assert.equal(resolveHasarVendorContractKind(0), 'detailed');
    assert.equal(resolveHasarVendorContractKind(99_999.99), 'detailed');
    assert.equal(resolveHasarVendorContractKind(100_000), 'detailed');
    assert.equal(hasarVendorContractKindLabel('simple'), 'Tedarikçi Sözleşmesi');
    assert.equal(isVendorContractManagerRole('office_staff'), false);
    assert.equal(isVendorContractManagerRole('admin'), true);
  });

  it('eski dizi kayıt detaylıdır; düzeltme isteği taşınır', () => {
    assert.equal(readVendorContractKind([{ id: '1' }]), 'detailed');
    const wrapped = wrapVendorContractWorkItems('detailed', [{ a: 1 }], {
      correctionRequest: {
        note: 'Adres yanlış',
        requestedByUserId: 'u1',
        requestedAt: '2026-09-05T00:00:00.000Z',
        status: 'pending',
      },
    });
    assert.deepEqual(unwrapVendorContractWorkItems(wrapped), [{ a: 1 }]);
    assert.equal(readVendorContractCorrectionRequest(wrapped)?.note, 'Adres yanlış');
  });

  it('onarım planlama görür; düzeltme yöneticiye gider; şirket vergi yoksa sözleşme basılmaz', () => {
    const ui = readFileSync(
      join(here, '../../../apps/web/src/app/panel/hasar-dosyalari/[id]/_components/tabs/SozlesmelerSection.tsx'),
      'utf8',
    );
    const guide = readFileSync(
      join(here, '../../../apps/web/src/components/hasar-operasyon-planlayicisi/PlannerVendorContractGuide.tsx'),
      'utf8',
    );
    const svc = readFileSync(
      join(here, '../../../apps/backend/src/modules/vendor-contracts/vendor-contracts.service.ts'),
      'utf8',
    );
    const vendors = readFileSync(
      join(here, '../../../apps/backend/src/modules/vendors/vendors.service.ts'),
      'utf8',
    );
    assert.match(ui, /Toplanan tedarikçi onayları/);
    assert.doesNotMatch(ui, /function CreateContractModal/);
    assert.doesNotMatch(ui, /Sözleşme Oluştur/);
    assert.match(guide, /yöneticiden düzeltme/);
    assert.doesNotMatch(guide, /HASAR_VENDOR_CONTRACT_DETAILED_MIN_TL/);
    assert.match(svc, /requestCorrection/);
    assert.match(svc, /vendorContractIdentityPrintLine/);
    assert.match(svc, /vendorContractIdentityMissing/);
    assert.match(svc, /isVendorContractManagerRole/);
    assert.match(svc, /Tedarikçi kaydında vergi no yok/);
    assert.doesNotMatch(svc, /Tedarikçi TC \/ Vergi/);
    assert.match(svc, /grid-column:1\/-1/);
    assert.match(vendors, /assertVendorIdentity/);
    assert.match(vendors, /identityGapVendorIds/);
    assert.match(vendors, /identityMissingCount/);
    const modal = readFileSync(
      join(here, '../../../apps/web/src/components/hasar-operasyon-planlayicisi/VendorContractPreviewModal.tsx'),
      'utf8',
    );
    assert.match(modal, /Yöneticiden düzeltme iste/);
    assert.doesNotMatch(modal, /Bu dosyaya özel düzenle/);
    assert.match(modal, /openWhatsAppChat/);
  });

  it('TC algoritması ve levha metin okuma', () => {
    assert.equal(isValidTcKimlikNo('10000000146'), true);
    assert.equal(vendorContractIdentityMissing({ entityType: 'individual', identityNo: null }), false);
    assert.equal(vendorContractIdentityMissing({ entityType: 'corporate', taxNumber: null }), true);
    const found = extractIdentityCandidatesFromText('Vergi No: 1234567890 TC 10000000146');
    assert.ok(found.tc.includes('10000000146'));
  });
});
