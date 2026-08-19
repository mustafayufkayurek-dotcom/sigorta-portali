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
});
