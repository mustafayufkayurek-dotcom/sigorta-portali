/**
 * Kaynak dosya kilidi — Yetkilendirme UI sözleşmesi sessizce bozulmasın.
 * Çalıştır: npx tsx --test src/app/panel/ayarlar/yetkilendirme/yetkilendirme.lock.spec.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';

const webSrc = join(__dirname, '../../../..');

function readRel(rel: string): string {
  return readFileSync(join(webSrc, rel), 'utf8');
}

describe('yetkilendirme LOCK', () => {
  it('kayan düğme (switch) kullanır; checkbox ile yetenek seçmez', () => {
    const page = readRel('app/panel/ayarlar/yetkilendirme/page.tsx');
    assert.match(page, /role="switch"/);
    assert.match(page, /bg-brand-600/);
    assert.match(page, /h-5 w-10/);
    assert.match(page, /SlideToggle/);
    assert.doesNotMatch(
      page,
      /type=["']checkbox["']/,
      'Yetenek seçimi tekrar checkbox olmamalı',
    );
  });

  it('yalnız iç operasyon rolleri; portal/eksper yok', () => {
    const page = readRel('app/panel/ayarlar/yetkilendirme/page.tsx');
    assert.match(page, /MANAGED_ROLE_CODES/);
    assert.match(page, /'office_staff'/);
    assert.match(page, /'finance'/);
    assert.doesNotMatch(page, /'expert'/);
    assert.doesNotMatch(page, /'adjuster'/);
    assert.doesNotMatch(page, /'insurance_company_user'/);
    assert.match(page, /Dosya Sorumlusu/);
  });

  it('SettingsPageLayout + Değişiklikleri Kaydet kalıbı', () => {
    const page = readRel('app/panel/ayarlar/yetkilendirme/page.tsx');
    assert.match(page, /SettingsPageLayout/);
    assert.match(page, /Değişiklikleri Kaydet/);
    assert.match(page, /capability-catalog/);
    assert.match(page, /\/capabilities/);
  });

  it('ayarlar nav + dosya sorumlusu menü + route access', () => {
    const nav = readRel('config/settings-nav.ts');
    assert.match(nav, /Yetkilendirme/);
    assert.match(nav, /\/panel\/ayarlar\/yetkilendirme/);

    const layout = readRel('app/panel/layout.tsx');
    assert.match(layout, /title: 'Yetkilendirme'/);
    assert.match(layout, /\/panel\/ayarlar\/yetkilendirme/);
    assert.match(layout, /path: '\/panel\/ayarlar\/yetkilendirme'/);

    const routes = readRel('utils/panel-route-access.rules.json');
    assert.match(routes, /\/panel\/ayarlar\/yetkilendirme/);
    assert.match(routes, /office_staff/);
  });

  it('UI’da ham permission kodu etiketi yok', () => {
    const page = readRel('app/panel/ayarlar/yetkilendirme/page.tsx');
    assert.doesNotMatch(page, /vendor\.delete/);
    assert.doesNotMatch(page, /permission\.code/);
  });
});
