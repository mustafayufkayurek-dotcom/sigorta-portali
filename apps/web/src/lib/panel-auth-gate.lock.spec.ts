/**
 * Adres çubuğundan oturumsuz panel girişi kilitli kalır.
 * Çalıştır: node --experimental-strip-types --test apps/web/src/lib/panel-auth-gate.lock.spec.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  girisRedirectUrl,
  hasPanelSessionCookies,
  isJwtCookieValue,
  isProtectedAppPath,
  isPublicUnauthenticatedPath,
  safePanelNextPath,
} from './panel-auth-gate.ts';

const here = dirname(fileURLToPath(import.meta.url));
const middleware = readFileSync(join(here, '../middleware.ts'), 'utf8');
const backendCookies = readFileSync(
  join(here, '../../../../apps/backend/src/common/auth/auth-cookies.ts'),
  'utf8',
);
const girisPage = readFileSync(join(here, '../app/giris/page.tsx'), 'utf8');
const panelLayout = readFileSync(join(here, '../app/panel/layout.tsx'), 'utf8');
const homePage = readFileSync(join(here, '../app/page.tsx'), 'utf8');

describe('panel oturum kapısı LOCK', () => {
  it('çerez yoksa panel ve kök girişe gider', () => {
    assert.match(middleware, /isProtectedAppPath/);
    assert.match(middleware, /hasPanelSessionCookies/);
    assert.match(middleware, /girisRedirectUrl/);
    assert.equal(isProtectedAppPath('/panel'), true);
    assert.equal(isProtectedAppPath('/panel/hasar-dosyalari'), true);
    assert.equal(isProtectedAppPath('/'), true);
    assert.equal(isPublicUnauthenticatedPath('/giris'), true);
    assert.equal(isPublicUnauthenticatedPath('/anket/abc'), true);
    assert.equal(isPublicUnauthenticatedPath('/kvkk'), true);
    assert.equal(isPublicUnauthenticatedPath('/gizlilik'), true);
    assert.equal(isPublicUnauthenticatedPath('/cerez-politikasi'), true);
    assert.equal(isPublicUnauthenticatedPath('/panel'), false);
  });

  it('sahte çerez veya kısa değer oturum sayılmaz', () => {
    assert.equal(isJwtCookieValue('1'), false);
    assert.equal(isJwtCookieValue('a.b.c'), false);
    assert.equal(
      hasPanelSessionCookies(() => undefined),
      false,
    );
  });

  it('giriş sayfası şifresiz otomatik geçmez', () => {
    assert.doesNotMatch(girisPage, /attemptAutoLogin/);
    assert.doesNotMatch(homePage, /attemptAutoLogin/);
  });

  it('panel oturumsuz boyanmaz; adres çubuğu girişe döner', () => {
    assert.match(panelLayout, /window\.location\.replace\('\/giris\?reason=auth'\)/);
    assert.match(panelLayout, /if \(loading \|\| !user\)/);
  });

  it('sunucu kısa kesilince oturum silinmez', () => {
    assert.match(panelLayout, /transientOutage/);
    assert.match(panelLayout, /status >= 500/);
    const axiosAuth = readFileSync(join(here, '../utils/setup-axios-auth.ts'), 'utf8');
    assert.match(axiosAuth, /error\.response\?\.status !== 401/);
  });

  it('açık yönlendirme yok; çerez adları aynı', () => {
    assert.equal(safePanelNextPath('https://evil.example/panel'), null);
    assert.equal(safePanelNextPath('//evil/panel'), null);
    assert.equal(safePanelNextPath('/panel/hasar-dosyalari'), '/panel/hasar-dosyalari');
    assert.match(girisRedirectUrl('/panel/hasar-dosyalari'), /reason=auth/);
    assert.match(backendCookies, /ACCESS_COOKIE_NAME/);
    assert.match(backendCookies, /@sigorta\/shared/);
  });
});
