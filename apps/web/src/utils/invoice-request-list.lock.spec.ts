/**
 * Finans fatura talepleri listesi — zarf, sekme ve kuyruk kilitleri.
 * Çalıştır: node --experimental-strip-types --test src/utils/invoice-request-list.lock.spec.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { getDefaultScreensForRole } from './screen-permissions-defaults.ts';
import {
  asInvoiceRequestList,
  faturaListTabHref,
  resolveFaturaListTab,
  unwrapApiData,
} from './invoice-request-envelope.ts';

const here = dirname(fileURLToPath(import.meta.url));
const read = (rel: string) => readFileSync(join(here, rel), 'utf8');

describe('invoice-request-list lock', () => {
  it('zarf ve ham diziyi listeye çevirir', () => {
    const rows = [{ id: 'ir-1' }, { id: 'ir-2' }];
    assert.deepEqual(asInvoiceRequestList({ success: true, data: rows }), rows);
    assert.deepEqual(asInvoiceRequestList(rows), rows);
    assert.deepEqual(asInvoiceRequestList({ items: rows }), rows);
    assert.deepEqual(asInvoiceRequestList({ success: true, data: { items: rows } }), rows);
    assert.deepEqual(asInvoiceRequestList(null), []);
    assert.equal(unwrapApiData({ success: true, data: { counts: { pendingCount: 3 } } }).counts.pendingCount, 3);
  });

  it('finans sekmesi tab yoksa talepler, açık kesilen korunur', () => {
    assert.equal(resolveFaturaListTab(null, true), 'talepler');
    assert.equal(resolveFaturaListTab('', true), 'talepler');
    assert.equal(resolveFaturaListTab('kesilen', true), 'kesilen');
    assert.equal(resolveFaturaListTab('talepler', false), 'talepler');
    assert.equal(resolveFaturaListTab(null, false), 'kesilen');
    assert.equal(faturaListTabHref('kesilen'), '/panel/finans/faturalar?tab=kesilen');
    assert.equal(faturaListTabHref('talepler'), '/panel/finans/faturalar?tab=talepler');
  });

  it('getInvoiceRequests zarfı çözer; boş query zorunlu ? eklemez', () => {
    const api = read('./invoiceRequestApi.ts');
    assert.match(api, /asInvoiceRequestList/);
    assert.match(api, /handleResponse<unknown>\(r\)\.then\(asInvoiceRequestList\)/);
    assert.match(api, /\$\{API\}\/invoice-requests\$\{qs \? `\?\$\{qs\}` : ''\}/);
  });

  it('controller fatura taleplerini { success, data } zarfıyla döner', () => {
    const controller = read('../../../backend/src/modules/invoice-requests/invoice-requests.controller.ts');
    assert.match(controller, /return \{ success: true, data \}/);
    assert.doesNotMatch(controller, /return this\.service\.findAll/);
    const service = read('../../../backend/src/modules/invoice-requests/invoice-requests.service.ts');
    assert.match(service, /syncMissingEmergencySalesRequests/);
  });

  it('ödeme API hatası fatura kuyruk kartını gizlemez', () => {
    const strip = read('../features/dashboard/components/finance/finance-queues-strip.tsx');
    assert.match(strip, /data-testid="finans-is-kuyruklari"/);
    assert.match(strip, /data-testid="finans-fatura-talepleri-kuyruk"/);
    assert.match(strip, /href="\/panel\/finans\/faturalar\?tab=talepler"/);
    assert.doesNotMatch(strip, /invoiceQuery\.isError \|\| paymentsQuery\.isError/);
    assert.doesNotMatch(strip, /Kuyruk verileri yüklenemedi/);
    assert.match(strip, /invoiceQuery\.isError/);
    assert.match(strip, /paymentsQuery\.isError/);
  });

  it('finans menüsü ve sayfa talepler sekmesini açık tutar', () => {
    const layout = read('../app/panel/layout.tsx');
    assert.match(layout, /title: 'Fatura Talepleri', href: '\/panel\/finans\/faturalar\?tab=talepler'/);
    assert.match(layout, /relatedEntityType === 'invoice_request'/);
    assert.match(layout, /\/panel\/finans\/faturalar\?tab=talepler/);
    assert.match(layout, /normalizedHref === '\/panel\/finans\/faturalar'/);
    assert.match(layout, /activeTabParam === hrefTab/);

    const page = read('../app/panel/finans/faturalar/page.tsx');
    assert.match(page, /resolveFaturaListTab/);
    assert.match(page, /faturaListTabHref\(tab\)/);
    assert.match(page, /Suspense/);
    assert.doesNotMatch(page, /tab === 'talepler' \? '\?tab=talepler' : ''/);
  });

  it('FINANS rolü varsayılan finans ekranlarını alır', () => {
    assert.ok(getDefaultScreensForRole('FINANS').includes('finans'));
    assert.ok(getDefaultScreensForRole('finans').includes('finans'));
    assert.ok(getDefaultScreensForRole('finance').includes('finans'));
    assert.deepEqual(getDefaultScreensForRole('FINANS'), getDefaultScreensForRole('finance'));
  });

  it('bildirim alıcı sorgusu FINANCE kodunu da kapsar', () => {
    const service = read('../../../backend/src/modules/invoice-requests/invoice-requests.service.ts');
    assert.match(service, /'FINANCE'/);
    assert.match(service, /relatedEntityType: 'invoice_request'/);
  });

  it('Faturalandı satış fatura numarası ister; İşlemler menüsü dosya sorumlusuna bildirir', () => {
    const dto = read('../../../backend/src/modules/invoice-requests/dto/invoice-requests.dto.ts');
    assert.match(dto, /salesInvoiceNo/);
    assert.match(dto, /cancelReason/);

    const service = read('../../../backend/src/modules/invoice-requests/invoice-requests.service.ts');
    assert.match(service, /Satış fatura numarası gerekli/);
    assert.match(service, /İptal açıklaması zorunlu/);
    assert.match(service, /linkOrCreateIssuedSalesInvoice/);
    assert.match(service, /notifyFileOwner/);
    assert.match(service, /sales_invoice_issued/);
    assert.match(service, /assignedOfficeUserId/);

    const controller = read('../../../backend/src/modules/invoice-requests/invoice-requests.controller.ts');
    assert.match(controller, /:id\/notify-owner/);

    const api = read('./invoiceRequestApi.ts');
    assert.match(api, /salesInvoiceNo/);
    assert.match(api, /notifyInvoiceRequestOwner/);
    assert.match(api, /invoice-requests\/\$\{id\}\/notify-owner/);

    const section = read('../components/finance/FaturaTalepleriSection.tsx');
    assert.match(section, /InvoiceRequestRowActions/);
    assert.match(section, /fatura-talep-satis-no-modal/);
    assert.match(section, /Satış fatura numarası/);
    assert.match(section, /FINANS_ACTIONS_COLUMN/);
    assert.match(section, /orderedVisibleColumns/);
    assert.match(section, /notifyInvoiceRequestOwner/);
    assert.match(section, /fatura-talep-icerik/);
    assert.match(section, /onView/);
    assert.match(section, /Yapılan İş Kalemi/);
    assert.match(section, /fatura-talep-iptal-modal/);
    assert.match(section, /İptal açıklaması zorunlu/);
    assert.doesNotMatch(section, /<select[\s\S]*DURUM_LABEL/);

    const actions = read('../components/finance/FinanceRowActions.tsx');
    assert.match(actions, /title="Görüntüle"/);
    assert.match(actions, /<Eye /);
    assert.match(actions, /fatura-talep-goruntule/);
    assert.match(actions, /title="Yazdır"/);
    assert.match(actions, /title="Dosya sorumlusuna bildir"/);
    assert.match(actions, /title="Düzenle"/);
    assert.match(actions, /title="İptal et"/);
    assert.match(actions, /<Printer /);
    assert.match(actions, /<Send /);
    assert.match(actions, /<Pencil /);
    assert.match(actions, /<XCircle /);
    assert.doesNotMatch(actions, /Kesilen faturalar dosya sorumlusuna bildirilsin/);
    assert.match(actions, /InvoiceRequestRowActions/);
    assert.match(actions, /fatura-talep-islemler/);

    const invoicesSvc = read('../../../backend/src/modules/invoices/invoices.service.ts');
    assert.match(invoicesSvc, /summary: \{/);
    assert.match(invoicesSvc, /totalCount: total/);
    assert.match(invoicesSvc, /params\.search/);
    assert.match(invoicesSvc, /emergencyCaseId/);
    const faturalar = read('../app/panel/finans/faturalar/page.tsx');
    assert.match(faturalar, /status !== 'cancelled'/);
    assert.match(faturalar, /summary\.totalAmount/);
    assert.match(faturalar, /metaTotal/);
    assert.match(faturalar, /invoiceIssuedFileHref/);
    assert.match(faturalar, /onIssuedChange/);
    assert.match(faturalar, /FINANS_ACTIONS_COLUMN/);
    assert.match(faturalar, /FinansTablePager/);
    assert.match(faturalar, /faturaTalepleriTabPulseClass/);
    assert.match(faturalar, /notify-owner/);
    assert.match(faturalar, /label: 'Müşteri'/);
    assert.doesNotMatch(faturalar, /label: 'Eksper'/);
    assert.match(faturalar, /orderedVisibleColumns/);
    assert.match(faturalar, /editReason/);
    assert.match(api, /fileOwnerNotifyToast/);
    assert.match(api, /recipients/);
    assert.match(section, /onIssuedChange/);
    assert.doesNotMatch(section, /invoiced' && prev.claimFileId/);
    assert.match(section, /label: 'Müşteri'/);
    assert.match(actions, /createObjectURL/);
  });

  it('asistans faturalar kesilen özetten okur; acil kesilen hasar dosyasına bağlanmaz', () => {
    const asistans = read('../app/panel/asistans-portal/faturalar/page.tsx');
    assert.match(asistans, /fetchPortalInvoices/);
    assert.doesNotMatch(asistans, /fetchPortalEmergencyBillingRows/);
    assert.match(asistans, /Ödenen Toplam/);
    assert.match(asistans, /s\.paidAmount/);
    const schema = read('../../../backend/prisma/schema.prisma');
    assert.match(schema, /emergencyCaseId\s+String\?\s+@map\("emergency_case_id"\)/);
    const invoicesSvc = read('../../../backend/src/modules/invoices/invoices.service.ts');
    assert.match(invoicesSvc, /touchClaimFinance/);
  });
});
