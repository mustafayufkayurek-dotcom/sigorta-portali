/**
 * Şirket sitesi yenileme sayacı kilidi.
 * Çalıştır: node --experimental-strip-types --test apps/web/src/utils/site-renewal.lock.spec.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  SITE_RENEWAL_UNTIL_ISO,
  isCompanyWebsiteHost,
  padRenewalUnit,
  siteRenewalParts,
  softwareLoginHref,
} from './site-renewal.ts';
import { isPublicUnauthenticatedPath } from '../lib/panel-auth-gate.ts';

const here = dirname(fileURLToPath(import.meta.url));
const page = readFileSync(join(here, '../app/yenileniyoruz/page.tsx'), 'utf8');
const loginPanel = readFileSync(join(here, '../components/giris/GirisLoginPanel.tsx'), 'utf8');
const css = readFileSync(join(here, '../app/yenileniyoruz/yenileniyoruz.css'), 'utf8');
const gate = readFileSync(join(here, '../lib/panel-auth-gate.ts'), 'utf8');
const middleware = readFileSync(join(here, '../middleware.ts'), 'utf8');
const cookieNotice = readFileSync(join(here, '../components/legal/CookieNotice.tsx'), 'utf8');

describe('şirket sitesi yenileme LOCK', () => {
  it('15 gün sonrası 30 Eylül 2026 İstanbul gecesidir', () => {
    assert.equal(SITE_RENEWAL_UNTIL_ISO, '2026-09-30T23:59:59+03:00');
    const start = Date.parse('2026-09-15T12:00:00+03:00');
    const parts = siteRenewalParts(start);
    assert.equal(parts.expired, false);
    assert.equal(parts.days, 15);
  });

  it('sayaç birimleri iki hanedir', () => {
    assert.equal(padRenewalUnit(3), '03');
    assert.equal(padRenewalUnit(15), '15');
  });

  it('süre dolunca sıfır kalır', () => {
    const parts = siteRenewalParts(Date.parse('2026-10-01T00:00:00+03:00'));
    assert.equal(parts.expired, true);
    assert.equal(parts.days, 0);
    assert.equal(parts.hours, 0);
  });

  it('yazılıma giriş canlı uygulamadır; yerelde iç giriş', () => {
    assert.equal(softwareLoginHref('meridyen-tr.com'), 'https://app.meridyen-tr.com/giris');
    assert.equal(softwareLoginHref('www.meridyen-tr.com'), 'https://app.meridyen-tr.com/giris');
    assert.equal(softwareLoginHref('localhost'), '/giris');
    assert.equal(softwareLoginHref('app.meridyen-tr.com'), '/giris');
  });

  it('sayaç sade durur; yazılıma giriş tuşu yoktur; giriş formu yazılıma gider', () => {
    assert.match(page, /Yenileniyoruz/);
    assert.match(page, /Hasar Platformu/);
    assert.match(page, /GirisLoginPanel/);
    assert.match(page, /setShowClock\(false\)/);
    assert.doesNotMatch(page, /Yazılıma Giriş/);
    assert.doesNotMatch(page, /CalendarFlipUnit/);
    assert.match(loginPanel, /Kullanıcı Girişi/);
    assert.match(loginPanel, /getLoginHomePath/);
    assert.match(loginPanel, /router\.replace/);
    assert.match(loginPanel, /isCompanyWebsiteHost/);
    assert.match(loginPanel, /app\.meridyen-tr\.com/);
    assert.match(css, /renewal-hero-top/);
    assert.doesNotMatch(css, /calendar-leaf-fold/);
    assert.doesNotMatch(page, /text-transform:\s*uppercase/);
  });

  it('kartlar yenileniyoruz sayfası açar; Türkiye haritası yerelde durur, sayfada yok', () => {
    const feature = readFileSync(join(here, '../app/yenileniyoruz/[slug]/page.tsx'), 'utf8');
    const slugs = readFileSync(join(here, '../app/yenileniyoruz/site-feature-pages.ts'), 'utf8');
    assert.match(page, /\/yenileniyoruz\/turkiye/);
    assert.match(slugs, /Yenileniyoruz \.\.\./);
    assert.match(slugs, /Tüm Türkiye'deyiz/);
    assert.doesNotMatch(slugs, /Hazırlanıyoruz/);
    assert.match(slugs, /map: false/);
    assert.match(feature, /page\.teaser/);
    assert.doesNotMatch(feature, /FieldOperationsMap/);
    assert.doesNotMatch(feature, /publicFilesOnly/);
    const chrome = readFileSync(join(here, '../app/yenileniyoruz/yenileniyoruz-chrome.tsx'), 'utf8');
    assert.match(chrome, /renewal-top-band/);
  });

  it('şirket sitesi kökü yenileme sayfasına düşer; yazılım kökü kapılı kalır', () => {
    assert.equal(isCompanyWebsiteHost('www.meridyen-tr.com'), true);
    assert.equal(isCompanyWebsiteHost('meridyen-tr.com'), true);
    assert.equal(isCompanyWebsiteHost('app.meridyen-tr.com'), false);
    assert.equal(isCompanyWebsiteHost('localhost'), false);
    assert.match(middleware, /isCompanyWebsiteHost/);
    assert.match(middleware, /pathname = '\/yenileniyoruz'/);
    assert.match(middleware, /app\.meridyen-tr\.com/);
    assert.equal(isPublicUnauthenticatedPath('/yenileniyoruz'), true);
    assert.match(gate, /\/yenileniyoruz/);
  });

  it('çerez şeridinde yönetme durur', () => {
    assert.match(cookieNotice, /Çerezleri Yönet/);
    assert.match(cookieNotice, /Anladım/);
    assert.match(loginPanel, /Çerezleri Yönet/);
  });
});
