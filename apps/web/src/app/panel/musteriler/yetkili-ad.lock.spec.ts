/**
 * Müşteri kartı yetkili adı: kirli unvan kayda girmez.
 * Çalıştır: node --experimental-strip-types --test apps/web/src/app/panel/musteriler/yetkili-ad.lock.spec.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const page = readFileSync(join(here, 'page.tsx'), 'utf8');
const notice = readFileSync(join(here, '../../../utils/ops-first-run-notice.ts'), 'utf8');

describe('müşteri yetkili adı LOCK', () => {
  it('form kuralı ve kayıt kesmesini taşır', () => {
    assert.match(page, /isDirtyAuthorizedPersonName/);
    assert.match(page, /AUTHORIZED_PERSON_DIRTY_MESSAGE/);
    assert.match(page, /OpsFirstRunNotice/);
    assert.match(page, /OPS_NOTICE\.musteriYetkiliAd/);
    assert.match(page, /musteri-yetkili-ad-ilk-kullanim-seridi/);
    assert.doesNotMatch(page, /OpenAI|ChatGPT|Google/);
  });

  it('şerit kişi adı kuralını anlatır', () => {
    assert.match(notice, /musteri-yetkili-ad-v533/);
    assert.match(notice, /Yazılım ad uydurmaz/);
  });
});
