/**
 * Test Notları tüm personel ekranlarından kalıcı silindi.
 * Çalıştır: node --experimental-strip-types --test src/utils/test-notlari-removed.lock.spec.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const webSrc = join(here, '..');

function readRel(rel: string): string {
  return readFileSync(join(webSrc, rel), 'utf8');
}

describe('Test Notları ekranı kaldırıldı LOCK', () => {
  it('sol menü, ayarlar hub ve ekran yetkisinde yok', () => {
    const layout = readRel('app/panel/layout.tsx');
    assert.doesNotMatch(layout, /title:\s*['"]Test Notları/);
    assert.doesNotMatch(layout, /TestTube2/);

    const nav = readRel('config/settings-nav.ts');
    assert.doesNotMatch(nav, /Test Notları/);
    assert.doesNotMatch(nav, /test-notlari-gorev-takip/);

    const ayarlarHub = readRel('app/panel/ayarlar/page.tsx');
    assert.doesNotMatch(ayarlarHub, /requiresTestNotesAccess/);
    assert.doesNotMatch(ayarlarHub, /showTestNotes/);

    const screens = readRel('utils/screen-permissions.ts');
    const defaults = readRel('utils/screen-permissions-defaults.ts');
    assert.doesNotMatch(screens, /test_notes_admin/);
    assert.doesNotMatch(screens, /Test Notları/);
    assert.doesNotMatch(defaults, /test_notes_admin/);

    const backendScreens = readFileSync(
      join(here, '../../../backend/src/modules/users/screen-permissions.defaults.ts'),
      'utf8',
    );
    assert.doesNotMatch(backendScreens, /test_notes_admin/);
    assert.doesNotMatch(backendScreens, /Test Notları/);
  });

  it('eski adres panele yönlendirir; erişim kapalı', () => {
    const page = readRel('app/panel/ayarlar/test-notlari-gorev-takip/page.tsx');
    assert.match(page, /redirect\('\/panel'\)/);
    const access = readRel('utils/test-notes-access.ts');
    assert.match(access, /return false/);
  });
});
