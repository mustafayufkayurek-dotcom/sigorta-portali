import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  acilSalesInvoiceRequestBody,
  canOpenAcilSalesInvoiceRequest,
  invoiceRequestActorUserId,
} from './acil-finance-invoice-request.ts';

const here = dirname(fileURLToPath(import.meta.url));
const read = (rel: string) => readFileSync(join(here, rel), 'utf8');

describe('acil satış fatura talebi LOCK', () => {
  it('Finansa gönderilmiş dosyada COZULDU olmasa da talep açılır', () => {
    assert.equal(
      canOpenAcilSalesInvoiceRequest({
        status: 'FATURALANDILDI',
        existingOpenRequest: false,
        gelirTotal: 1500,
      }),
      true,
    );
    assert.equal(
      canOpenAcilSalesInvoiceRequest({
        status: 'COZULDU',
        existingOpenRequest: false,
        gelirTotal: 1500,
      }),
      true,
    );
    assert.equal(
      canOpenAcilSalesInvoiceRequest({
        status: 'FATURALANDILDI',
        existingOpenRequest: false,
        gelirTotal: 0,
      }),
      false,
    );
    assert.equal(
      canOpenAcilSalesInvoiceRequest({
        status: 'SAHADA',
        existingOpenRequest: false,
        gelirTotal: 1500,
      }),
      false,
    );
  });

  it('müşteri kimliğini sigorta şirketi id olarak yazmaz', () => {
    const body = acilSalesInvoiceRequestBody({
      emergencyCaseId: 'ec-1',
      caseNo: 'AY-1',
      fileNo: 'AY-1',
      customerName: 'Sezgi Global',
      gelirEntries: [{ description: 'Hizmet', amount: 2500 }],
    });
    assert.equal(body.serviceType, 'emergency');
    assert.equal(body.totalAmount, 2500);
    assert.equal('insuranceCompanyId' in body, false);
    assert.equal(body.insuranceCompanyName, 'Sezgi Global');
  });

  it('system aktörü dosya oluşturan kişiye düşer', () => {
    assert.equal(invoiceRequestActorUserId('system', 'user-1'), 'user-1');
    assert.equal(invoiceRequestActorUserId('user-9', 'user-1'), 'user-9');
  });

  it('Finansa gönderim kapanış COZULDU kapısını beklemez; kuyruk eksikleri tamamlar', () => {
    const transfer = read('./emergency-cases.service.ts');
    assert.match(transfer, /canOpenAcilSalesInvoiceRequest/);
    assert.match(transfer, /skipClosureCheck:\s*true/);
    assert.doesNotMatch(transfer, /insuranceCompanyId:\s*emergencyCase\.customerId/);
    const ir = read('../invoice-requests/invoice-requests.service.ts');
    assert.match(ir, /syncMissingEmergencySalesRequests/);
    const smoke = read('../../../scripts/smoke-acil-netlesen.sh');
    assert.match(smoke, /acil-finance-invoice-request\.lock\.spec/);
    const docs = read('../file-documents/file-documents.service.ts');
    assert.match(docs, /FATURALANDILDI/);
  });
});
