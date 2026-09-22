/**
 * Telefonda Yönetim Paneli, sol menü ve Hasar şeridi kesilmez.
 * Çalıştır: node --experimental-strip-types --test apps/web/src/utils/panel-cep-duzen.lock.spec.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const webSrc = join(here, '..');
const read = (rel: string) => readFileSync(join(webSrc, rel), 'utf8');

describe('panel cep düzen LOCK', () => {
  it('Yönetim Paneli başlık ve dönem tuşları alta alta durur', () => {
    const header = read('features/dashboard/components/management-dashboard/MgmtHeader.tsx');
    assert.match(header, /flex-col/);
    assert.match(header, /whitespace-nowrap/);
    assert.match(header, /Yönetim Paneli/);
    assert.doesNotMatch(header, /whitespace-normal/);
    const kpi = read('features/dashboard/components/management-dashboard/MgmtKpiRow.tsx');
    assert.match(kpi, /break-words/);
    const dash = read('features/dashboard/components/management-dashboard/ManagementDashboard.tsx');
    assert.match(dash, /safe-area-inset-bottom/);
  });

  it('sol menü yazıları kesilmez; Anladım metnin içinde kalmaz', () => {
    const layout = read('app/panel/layout.tsx');
    assert.match(layout, /createPortal/);
    assert.match(layout, /panel-mobile-nav/);
    assert.match(layout, /safe-area-inset-left/);
    assert.match(layout, /min-w-0 whitespace-normal break-words/);
    const notice = read('components/operasyon/OpsFirstRunNotice.tsx');
    assert.match(notice, /flex flex-col gap-2/);
    assert.match(notice, /Anladım/);
    const css = read('app/globals.css');
    assert.match(css, /page-header/);
    assert.match(css, /flex-col items-stretch/);
  });

  it('Hasar listesinde şerit kartların üstüne binmez', () => {
    const hasar = read('app/panel/hasar-dosyalari/page.tsx');
    assert.match(hasar, /hasar-liste-ilk-kullanim-seridi/);
    const headerEnd = hasar.indexOf('page-header-actions');
    const notice = hasar.indexOf('hasar-liste-ilk-kullanim-seridi');
    const kpi = hasar.indexOf('hasar-kpi-band');
    assert.ok(headerEnd >= 0 && notice > headerEnd, 'şerit başlık tuşunun yanında değil');
    assert.ok(kpi > notice, 'şerit kartlardan önce tam genişlikte durur');
  });

  it('giriş kodu Yapıştır ve kutu adı durur', () => {
    const giris = read('components/giris/GirisLoginPanel.tsx');
    assert.match(giris, /Yapıştır/);
    assert.match(giris, /maskLoginMailbox/);
    assert.doesNotMatch(giris, /000000/);
  });
});
