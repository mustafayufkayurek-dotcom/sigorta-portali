import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { invoiceIssuedFileHref, invoiceIssuedFileNo, invoicePartyCustomerName } from './invoice-customer-name.ts';

describe('invoice-customer-name', () => {
  it('sigortalı tahsilatta sigortalı adını basar', () => {
    assert.equal(
      invoicePartyCustomerName({
        collectionParty: 'insured',
        insuredName: 'Ayşe Yılmaz',
        customer: { companyName: 'Firma A' },
        insuranceCompanyName: 'Ray Sigorta',
      }),
      'Ayşe Yılmaz',
    );
  });

  it('müşteri kısa adını tercih eder', () => {
    assert.equal(
      invoicePartyCustomerName({
        customer: { shortName: 'Acme', companyName: 'Acme A.Ş.', fullName: 'Acme Holding' },
        insuranceCompanyName: 'Allianz',
      }),
      'Acme',
    );
  });

  it('acil müşteri adını kullanır', () => {
    assert.equal(
      invoicePartyCustomerName({
        emergencyCustomerName: 'Sezgi Global',
      }),
      'Sezgi Global',
    );
  });

  it('acil dosya kesilen faturada hasar yoluna düşmez', () => {
    assert.equal(
      invoiceIssuedFileHref({ emergencyCaseId: 'ec-1', claimFileId: null }),
      '/panel/acil-yardim/ec-1',
    );
    assert.equal(invoiceIssuedFileNo({ emergencyCase: { caseNo: 'AY-9' } }), 'AY-9');
  });
});
