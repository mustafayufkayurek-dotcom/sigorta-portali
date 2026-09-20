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
    const panel = read('components/giris/GirisLoginPanel.tsx');
    assert.match(giris, /GirisLoginPanel/);
    assert.match(panel, /href="\/kvkk"/);
    assert.match(panel, /href="\/gizlilik"/);
    assert.match(panel, /href="\/cerez-politikasi"/);
    assert.doesNotMatch(giris, /KvkkConsentCheckbox/);
  });

  it('anket, sözleşme ve evrak onayında kutu durur', () => {
    assert.match(read('app/anket/[token]/page.tsx'), /KvkkConsentCheckbox/);
    assert.match(read('app/sozlesme/[token]/page.tsx'), /KvkkConsentCheckbox/);
    assert.match(read('app/evrak/[token]/page.tsx'), /KvkkConsentCheckbox/);
  });

  it('çerez şeridi kök yerleşimde durur', () => {
    assert.match(read('app/layout.tsx'), /CookieNotice/);
    assert.match(read('components/legal/CookieNotice.tsx'), /Çerezleri Yönet/);
  });

  it('kamu sayfasında taslak / avukat bekler uyarısı yok', () => {
    const page = read('components/legal/LegalDocumentPage.tsx');
    assert.doesNotMatch(page, /operasyon taslağı/);
    assert.doesNotMatch(page, /avukatı onaylamadan/);
    assert.match(page, /Ayarlar → Sözleşmeler/);
  });
});
