/**
 * Sigortalı ödemeli tahsilat kilidi.
 * Çalıştır:
 *   node --experimental-strip-types --test apps/web/src/utils/hasar-collection-party.lock.spec.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { OPS_NOTICE } from './ops-first-run-notice.ts';
import {
  resolveFileFeeCollectionSource,
  defaultInvoiceCounterpartyType,
  defaultPaymentPayerType,
  financeCounterpartyLabel,
} from '../../../../packages/shared/src/collection-party.ts';

const here = dirname(fileURLToPath(import.meta.url));
const read = (rel: string) => readFileSync(join(here, rel), 'utf8');

describe('sigortalı ödemeli tahsilat LOCK', () => {
  it('şirket id olsa bile otomatik dosya bedeli sigortalıya yazılır', () => {
    assert.equal(
      resolveFileFeeCollectionSource({
        collectionParty: 'insured',
        insuranceCompanyId: 'co-1',
      }),
      'insured',
    );
    const revenue = read('../../../backend/src/modules/finance/claim-file-revenue.service.ts');
    assert.match(revenue, /resolveFileFeeCollectionSource/);
    assert.match(revenue, /collectionParty/);
    assert.doesNotMatch(
      revenue,
      /collectionSource: claim\?\.insuranceCompanyId \? 'insurance_company' : 'insured'/,
    );
  });

  it('fatura varsayılanı insured; Müşteri eksper kartı olarak kalır', () => {
    assert.equal(defaultInvoiceCounterpartyType('insured'), 'insured');
    assert.equal(financeCounterpartyLabel('insured'), 'Sigortalı');
    assert.equal(financeCounterpartyLabel('customer'), 'Müşteri');
    const fatura = read('../app/panel/hasar-dosyalari/[id]/_components/tabs/finans-subtabs.tsx');
    assert.match(fatura, /option value="insured">Sigortalı/);
    assert.match(fatura, /defaultInvoiceCounterpartyType/);
    assert.match(fatura, /hasar-fatura-sigortali-not/);
    const invoiceDto = read('../../../backend/src/modules/invoices/dto/create-invoice.dto.ts');
    assert.match(invoiceDto, /'insured'/);
    const invoiceSvc = read('../../../backend/src/modules/invoices/invoices.service.ts');
    assert.match(invoiceSvc, /coerceSalesInvoiceCounterparty/);
    assert.match(invoiceSvc, /counterpartyType === 'insured'/);
  });

  it('tahsilat etiketi Sigortalıdır; payerType insured', () => {
    assert.equal(defaultPaymentPayerType('insured'), 'insured');
    const gelir = read('../components/finance/ClaimFileGelirTahsilatPanel.tsx');
    assert.match(gelir, /option value="insured">Sigortalı/);
    assert.match(gelir, /defaultPaymentPayerType/);
    assert.match(gelir, /payerType: defaultPaymentPayerType/);
    const payDto = read('../../../backend/src/modules/payments/dto/create-payment.dto.ts');
    assert.match(payDto, /'insured'/);
    const paySvc = read('../../../backend/src/modules/payments/payments.service.ts');
    assert.match(paySvc, /coerceIncomingPayerType/);
  });

  it('Finans seçimi, özet rozet ve ilk kullanım şeridi durur', () => {
    const schema = read('../../../backend/prisma/schema.prisma');
    assert.match(schema, /collectionParty/);
    assert.match(schema, /insurance_company.*insured/);
    const migration = read(
      '../../../backend/prisma/migrations/20260831160000_claim_collection_party/migration.sql',
    );
    assert.match(migration, /collection_party/);
    const finansTab = read('../app/panel/hasar-dosyalari/[id]/_components/tabs/FinansTab.tsx');
    assert.doesNotMatch(finansTab, /HasarCollectionPartyPanel/);
    assert.doesNotMatch(finansTab, /hasar-sigortali-odemeli-seridi/);
    const card = read('../components/hasar-operasyon-planlayicisi/HasarSalesInvoiceRequestCard.tsx');
    assert.match(card, /Satış faturası talebi/);
    assert.match(card, /Fatura kime kesilsin/);
    assert.match(card, /Finansa talep et/);
    assert.match(card, /hasarInvoiceRequestGoneLabel/);
    assert.match(card, /createInvoiceRequest/);
    assert.match(card, /OPS_NOTICE\.hasarSigortaliOdemeli/);
    assert.match(card, /hasar-sigortali-odemeli-seridi/);
    const steps = read('../components/hasar-operasyon-planlayicisi/steps.tsx');
    assert.match(steps, /HasarSalesInvoiceRequestCard/);
    const page = read('../app/panel/hasar-dosyalari/[id]/page.tsx');
    assert.match(page, /hasar-sigortali-odemeli-rozet/);
    assert.match(page, /Sigortalı ödemeli/);
    const ozet = read('../app/panel/hasar-dosyalari/[id]/_components/tabs/FinansOzetPanel.tsx');
    assert.match(ozet, /hasar-sigortali-tahsil-ozet/);
    assert.match(ozet, /Sigortalıdan tahsil/);
    const fatura = read('../app/panel/hasar-dosyalari/[id]/_components/tabs/finans-subtabs.tsx');
    assert.match(fatura, /hasar-fatura-talep-durum/);
    assert.doesNotMatch(fatura, /ClosureConditionsPanel/);
    assert.match(schema, /collectionPartyLocked/);
    const lockMig = read(
      '../../../backend/prisma/migrations/20260831200000_claim_collection_party_locked/migration.sql',
    );
    assert.match(lockMig, /collection_party_locked/);
    const claimSvc = read('../../../backend/src/modules/claim-files/claim-files.service.ts');
    assert.match(claimSvc, /isCollectionPartyChangeBlocked/);
    assert.match(claimSvc, /canToggleCollectionPartyLock/);
    const invoiceReq = read('../../../backend/src/modules/invoice-requests/invoice-requests.service.ts');
    assert.match(invoiceReq, /collectionPartyLocked: true/);
    const detay = read('../app/panel/hasar-dosyalari/[id]/_components/DosyaBilgileriDetay.tsx');
    assert.match(detay, /HasarCollectionPartyAdminLock/);
    const adminLock = read('../app/panel/hasar-dosyalari/[id]/_components/HasarCollectionPartyAdminLock.tsx');
    assert.match(adminLock, /hasar-tahsilat-admin-kilit/);
    assert.match(adminLock, /Kilidi aç/);
    assert.equal(OPS_NOTICE.hasarSigortaliOdemeli.id, 'hasar-satis-faturasi-talebi-v548');
    assert.match(OPS_NOTICE.hasarSigortaliOdemeli.body, /sigorta şirketi carisine yazılmaz/);
    assert.match(OPS_NOTICE.hasarSigortaliOdemeli.body, /Finans’te tekrar sorulmaz/);
  });
});
