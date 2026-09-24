/**
 * Personel sayfası test şeridi: puantaj dışı bilgi dikkate alınmaz.
 * Çalıştır: node --experimental-strip-types --test \
 *   apps/web/src/app/panel/personel-ozluk/personel-test-asama.lock.spec.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const page = readFileSync(join(here, 'page.tsx'), 'utf8');

describe('personel test aşaması şeridi LOCK', () => {
  it('şerit durur; Anladım ile kapanmaz', () => {
    assert.match(page, /personel-test-asama-seridi/);
    assert.match(page, /Sayfa Test Aşamasındadır/);
    assert.match(page, /Puantaj Bilgileri Dışındaki Bilgileri Dikkate Almayınız/);
    assert.doesNotMatch(page, /Pauntaj/);
    const banner = page.slice(
      page.indexOf('personel-test-asama-seridi'),
      page.indexOf('personel-test-asama-seridi') + 900,
    );
    assert.doesNotMatch(banner, /Anladım/);
    assert.doesNotMatch(banner, /localStorage/);
  });
});
