/**
 * Çalıştır:
 *   node --experimental-strip-types --test packages/shared/src/collection-party.lock.spec.ts
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  COLLECTION_PARTY,
  coerceIncomingPayerType,
  coerceSalesInvoiceCounterparty,
  collectionPartyLabel,
  canToggleCollectionPartyLock,
  hasarInvoiceRequestGoneLabel,
  isCollectionPartyChangeBlocked,
  defaultInvoiceCounterpartyType,
  defaultPaymentPayerType,
  financeCounterpartyLabel,
  isInsuredCollectionParty,
  parseCollectionParty,
  resolveFileFeeCollectionSource,
} from './collection-party.ts';

describe('sigortalı ödemeli tahsilat kuralı', () => {
  it('varsayılan sigorta şirketidir; insured ayrıdır', () => {
    assert.equal(parseCollectionParty(undefined), null);
    assert.equal(parseCollectionParty('insured'), COLLECTION_PARTY.insured);
    assert.equal(isInsuredCollectionParty('insurance_company'), false);
    assert.equal(isInsuredCollectionParty('insured'), true);
    assert.equal(collectionPartyLabel('insured'), 'Sigortalı ödemeli');
    assert.equal(collectionPartyLabel('insurance_company'), 'Sigorta Şirketi');
    assert.equal(hasarInvoiceRequestGoneLabel('insured'), 'Talep gitti · Sigortalı');
    assert.equal(hasarInvoiceRequestGoneLabel('insurance_company'), 'Talep gitti · Sigorta Şirketi');
    assert.equal(canToggleCollectionPartyLock('admin'), true);
    assert.equal(canToggleCollectionPartyLock('office_staff'), false);
    assert.equal(isCollectionPartyChangeBlocked({ locked: true, isAdmin: false }), true);
    assert.equal(isCollectionPartyChangeBlocked({ locked: true, isAdmin: true, unlocking: true }), false);
    assert.equal(isCollectionPartyChangeBlocked({ locked: false }), false);
  });

  it('şirket id olsa bile sigortalı ödemeli dosya bedeli sigortalıya yazılır', () => {
    assert.equal(
      resolveFileFeeCollectionSource({
        collectionParty: 'insured',
        insuranceCompanyId: 'co-1',
      }),
      'insured',
    );
    assert.equal(
      resolveFileFeeCollectionSource({
        collectionParty: 'insurance_company',
        insuranceCompanyId: 'co-1',
      }),
      'insurance_company',
    );
    assert.equal(
      resolveFileFeeCollectionSource({
        collectionParty: 'insurance_company',
        insuranceCompanyId: null,
      }),
      'insured',
    );
  });

  it('fatura ve tahsilat varsayılanı dosya kararına uyar; Müşteri eksper kartıdır', () => {
    assert.equal(defaultInvoiceCounterpartyType('insured'), 'insured');
    assert.equal(defaultPaymentPayerType('insured'), 'insured');
    assert.equal(financeCounterpartyLabel('insured'), 'Sigortalı');
    assert.equal(financeCounterpartyLabel('customer'), 'Müşteri');
  });

  it('satış faturası ve gelen tahsilat sigorta/müşteri seçimini sigortalıya çevirir', () => {
    assert.equal(
      coerceSalesInvoiceCounterparty({
        collectionParty: 'insured',
        invoiceType: 'sales',
        counterpartyType: 'insurance_company',
      }),
      'insured',
    );
    assert.equal(
      coerceIncomingPayerType({
        collectionParty: 'insured',
        paymentType: 'incoming',
        payerType: 'customer',
      }),
      'insured',
    );
    assert.equal(
      coerceIncomingPayerType({
        collectionParty: 'insurance_company',
        paymentType: 'incoming',
        payerType: 'customer',
      }),
      'customer',
    );
  });
});
