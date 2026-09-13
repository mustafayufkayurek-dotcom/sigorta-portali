/**
 * Finans tabloları — sayfalama, dar İşlemler, öncelikli görev.
 * Çalıştır: node --experimental-strip-types --test src/utils/finans-table-page.lock.spec.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  faturaTalepleriTabPulseClass,
  INVOICE_REQUEST_TITLE_FLASH,
  unseenInvoiceRequestIds,
} from './invoice-request-alert.ts';

const here = dirname(fileURLToPath(import.meta.url));
const read = (rel: string) => readFileSync(join(here, rel), 'utf8');

function sliceFinansPage<T>(rows: T[], page: number, pageSize: number) {
  const total = rows.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize) || 1);
  const safePage = Math.min(Math.max(1, page), totalPages);
  return {
    safePage,
    slice: rows.slice((safePage - 1) * pageSize, safePage * pageSize),
    total,
  };
}

describe('finans-table-page lock', () => {
  it('İşlemler sütunu sağda dar ve kaydırılmaz', () => {
    const src = read('./finans-table-page.ts');
    assert.match(src, /id: 'actions'/);
    assert.match(src, /defaultWidth: 164/);
    assert.match(src, /pin: 'end'/);
    assert.match(src, /resizable: false/);
  });

  it('sayfa dilimi taşan sayfayı sona çeker', () => {
    const rows = Array.from({ length: 45 }, (_, i) => i + 1);
    const first = sliceFinansPage(rows, 1, 10);
    assert.deepEqual(first.slice, rows.slice(0, 10));
    assert.equal(first.total, 45);
    assert.equal(first.safePage, 1);
    const last = sliceFinansPage(rows, 9, 10);
    assert.equal(last.safePage, 5);
    assert.deepEqual(last.slice, rows.slice(40, 45));
    const util = read('./finans-table-page.ts');
    assert.match(util, /function sliceFinansPage/);
    assert.match(util, /function finansPageNumbers/);
    const pageSize = read('./ops-list-page-size.ts');
    assert.match(pageSize, /\[10, 20, 50, 100, 150\]/);
    assert.match(pageSize, /DEFAULT_OPS_LIST_PAGE_SIZE: OpsListPageSize = 10/);
  });

  it('sekiz finans sayfası pager ve Faturalar dar İşlemler kullanır', () => {
    const pages = [
      '../app/panel/finans/faturalar/page.tsx',
      '../components/finance/FaturaTalepleriSection.tsx',
      '../app/panel/finans/karlilik/page.tsx',
      '../app/panel/finans/portfolyo-pl/page.tsx',
      '../app/panel/finans/dosya-pl/page.tsx',
      '../app/panel/finans/banka-hesaplari/page.tsx',
      '../app/panel/finans/kdv-raporu/page.tsx',
      '../app/panel/finans/masraflar/page.tsx',
      '../app/panel/finans/tahsilatlar/page.tsx',
      '../app/panel/raporlar/finansal/page.tsx',
    ];
    for (const rel of pages) {
      const src = read(rel);
      assert.match(src, /FinansTablePager/, rel);
    }
    const withActions = [
      '../app/panel/finans/faturalar/page.tsx',
      '../components/finance/FaturaTalepleriSection.tsx',
      '../app/panel/finans/banka-hesaplari/page.tsx',
      '../app/panel/finans/masraflar/page.tsx',
    ];
    for (const rel of withActions) {
      const src = read(rel);
      assert.match(src, /FINANS_ACTIONS_COLUMN/, rel);
      assert.match(src, /colId="actions"/, rel);
    }
    const faturalar = read('../app/panel/finans/faturalar/page.tsx');
    const talepler = read('../components/finance/FaturaTalepleriSection.tsx');
    assert.match(faturalar, /orderedVisibleColumns\.map/);
    assert.match(talepler, /orderedVisibleColumns\.map/);
    assert.match(faturalar, /editReason/);
    assert.match(faturalar, /Düzenleme nedeni/);
    assert.match(faturalar, /fileOwnerNotifyToast/);
  });

  it('KDV raporu faturalar gibi tam ekrana oturur', () => {
    const kdv = read('../app/panel/finans/kdv-raporu/page.tsx');
    assert.match(kdv, /min-h-screen bg-white/);
    assert.match(kdv, /space-y-5 p-6/);
    assert.doesNotMatch(kdv, /max-w-6xl mx-auto/);
  });

  it('yeni talepte sekme yanar; bekleyen varken yanar', () => {
    assert.equal(faturaTalepleriTabPulseClass(2, 1), 'animate-pulse ring-2 ring-amber-400 ring-offset-1');
    assert.equal(faturaTalepleriTabPulseClass(2, 0), 'animate-pulse ring-2 ring-amber-400 ring-offset-1');
    assert.equal(faturaTalepleriTabPulseClass(0, 1), '');
    assert.deepEqual(unseenInvoiceRequestIds(['a', 'b'], ['a']), ['b']);
    assert.equal(INVOICE_REQUEST_TITLE_FLASH, '● Yeni fatura talebi');
  });

  it('finans girişinde öncelikli görev penceresi Sayfaya git açar', () => {
    const modal = read('../components/finance/FinansOncelikliGorevModal.tsx');
    assert.match(modal, /finans-oncelikli-gorev/);
    assert.match(modal, /Sayfaya git/);
    assert.match(modal, /\/panel\/finans\/faturalar\?tab=talepler/);
    assert.match(modal, /tab'\) === 'talepler'/);
    const layout = read('../app/panel/layout.tsx');
    assert.match(layout, /FinansOncelikliGorevModal/);
    assert.match(layout, /<Suspense fallback=\{null\}>/);
  });

  it('KDV bilgi sayfasıdır; resmi beyanname değildir', () => {
    const kdv = read('../app/panel/finans/kdv-raporu/page.tsx');
    assert.match(kdv, /Resmi beyanname değildir/);
    assert.match(kdv, /Taslak fatura girer; iptal girmez/);
    assert.match(kdv, /sıfır doğrudur/);
    assert.doesNotMatch(kdv, /mali müşavir denetimi/);
  });

  it('fatura talebi kesilen faturadan ayrı anlatılır', () => {
    const faturalar = read('../app/panel/finans/faturalar/page.tsx');
    const talepler = read('../components/finance/FaturaTalepleriSection.tsx');
    assert.match(faturalar, /Kesilen Faturalar kayıttır/);
    assert.match(talepler, /Kesilmiş fatura değil; kapanıştan gelen kesilecek talep/);
  });

  it('tedarikçi ödeme kuyruğu ayrı sayfa değildir', () => {
    const tahsilat = read('../app/panel/finans/tahsilatlar/page.tsx');
    const modules = read('../features/dashboard/components/finance/finance-modules.constants.ts');
    assert.match(tahsilat, /Tedarikçi Ödeme Kuyruğu/);
    assert.match(tahsilat, /ayrı sayfa değildir/);
    assert.match(modules, /FINANS_KART_YOL\.tedarikciOdeme/);
    assert.match(modules, /Resmi beyanname değildir/);
  });
});
