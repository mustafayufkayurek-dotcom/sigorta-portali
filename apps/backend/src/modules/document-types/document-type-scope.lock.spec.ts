import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  allowsClaimManualPhysicalKind,
  isClaimInsuredCatalogDocumentType,
  isDocumentTypeId,
} from './document-type-scope.ts';

describe('claim insured catalog document type', () => {
  it('yalnız aktif müşteri-sigortalı tanımını kabul eder', () => {
    assert.equal(
      isClaimInsuredCatalogDocumentType({
        status: 'active',
        entityScope: 'customer',
        customerSubTypes: ['insured'],
      }),
      true,
    );
    assert.equal(
      isClaimInsuredCatalogDocumentType({
        status: 'active',
        entityScope: 'vendor',
        customerSubTypes: ['insured'],
      }),
      false,
    );
    assert.equal(
      isClaimInsuredCatalogDocumentType({
        status: 'inactive',
        entityScope: 'customer',
        customerSubTypes: ['insured'],
      }),
      false,
    );
  });

  it('matbu süreç kind fiziki katalog değildir', () => {
    assert.equal(allowsClaimManualPhysicalKind('matbu_evrak'), false);
    assert.equal(allowsClaimManualPhysicalKind('anket_formu'), true);
    assert.equal(isDocumentTypeId('not-a-uuid'), false);
  });
});
