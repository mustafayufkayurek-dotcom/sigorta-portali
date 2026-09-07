/**
 * Kamuoyu KVKK sayfaları ve form onay kutusu durur.
 * Çalıştır: node --experimental-strip-types --test apps/web/src/lib/legal-public.lock.spec.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');

function read(rel: string) {
  return readFileSync(join(root, rel), 'utf8');
}

describe('kamuoyu KVKK LOCK', () => {
  it('aydınlatma, gizlilik ve çerez sayfaları durur', () => {
    assert.match(read('app/kvkk/page.tsx'), /KVKK_AYDINLATMA_SECTIONS/);
    assert.match(read('app/gizlilik/page.tsx'), /GIZLILIK_SECTIONS/);
    assert.match(read('app/cerez-politikasi/page.tsx'), /CEREZ_SECTIONS/);
  });

  it('girişte link vardır; personel kutusu girişte zorunlu değildir', () => {
    const giris = read('app/giris/page.tsx');
    assert.match(giris, /href="\/kvkk"/);
    assert.match(giris, /href="\/gizlilik"/);
    assert.match(giris, /href="\/cerez-politikasi"/);
    assert.doesNotMatch(giris, /KvkkConsentCheckbox/);
  });

  it('anket, sözleşme ve evrak onayında kutu durur', () => {
    assert.match(read('app/anket/[token]/page.tsx'), /KvkkConsentCheckbox/);
    assert.match(read('app/sozlesme/[token]/page.tsx'), /KvkkConsentCheckbox/);
    assert.match(read('app/evrak/[token]/page.tsx'), /KvkkConsentCheckbox/);
  });

  it('çerez şeridi kök yerleşimde durur', () => {
    assert.match(read('app/layout.tsx'), /CookieNotice/);
  });
});
