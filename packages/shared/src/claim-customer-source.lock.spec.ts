/**
 * Yeni Dosya müşteri kaynağı — tekrar eden kanal sorulmaz.
 * Çalıştır: node --experimental-strip-types --test packages/shared/src/claim-customer-source.lock.spec.ts
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  claimCustomerSourceAllowsPrivateAlongside,
  claimCustomerSourceContactLabel,
  claimCustomerSourceFromSubType,
  claimCustomerSourceHidesChannel,
  claimCustomerSourceSubType,
  parseClaimCustomerSource,
} from './claim-customer-source.ts';

describe('yeni dosya müşteri kaynağı', () => {
  it('sigorta, broker ve eksper kendi kutusunu bir daha sormaz', () => {
    assert.equal(parseClaimCustomerSource('sigorta'), 'insurance');
    assert.equal(parseClaimCustomerSource('broker'), 'broker');
    assert.equal(parseClaimCustomerSource(''), 'expert');
    assert.equal(claimCustomerSourceHidesChannel('insurance', 'insurance'), true);
    assert.equal(claimCustomerSourceHidesChannel('insurance', 'broker'), false);
    assert.equal(claimCustomerSourceHidesChannel('broker', 'broker'), true);
    assert.equal(claimCustomerSourceHidesChannel('expert', 'expert'), true);
    assert.equal(claimCustomerSourceHidesChannel('private', 'insurance'), false);
  });

  it('özel müşteri tek başına ve diğer üçünün altında durur; kart kişisi sorulur', () => {
    assert.equal(claimCustomerSourceSubType('insurance'), 'sigorta_sirketi');
    assert.equal(claimCustomerSourceSubType('broker'), 'broker_firmasi');
    assert.equal(claimCustomerSourceSubType('expert'), 'eksper_firmasi');
    assert.equal(claimCustomerSourceSubType('private'), 'private_customer');
    assert.equal(claimCustomerSourceAllowsPrivateAlongside('broker'), true);
    assert.equal(claimCustomerSourceAllowsPrivateAlongside('private'), false);
    assert.equal(claimCustomerSourceContactLabel('insurance'), 'Dosya Sorumlusu (Sigorta Şirketi)');
    assert.equal(claimCustomerSourceFromSubType('sigorta_sirketi'), 'insurance');
    assert.equal(claimCustomerSourceFromSubType('broker_firmasi'), 'broker');
    assert.equal(claimCustomerSourceContactLabel('private'), null);
  });
});
