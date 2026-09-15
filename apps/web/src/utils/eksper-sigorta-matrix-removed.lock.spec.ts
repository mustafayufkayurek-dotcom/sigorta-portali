/**
 * Kare kutu ayar sayfası kalktı. İlişki dosyadan tanınır.
 * Çalıştır: node --experimental-strip-types --test apps/web/src/utils/eksper-sigorta-matrix-removed.lock.spec.ts
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

describe('eksper–sigorta kare kutu kalktı LOCK', () => {
  it('ayarlar menüsünde matris yok; eski adres müşteri kartına döner', () => {
    const nav = readRel('config/settings-nav.ts');
    assert.doesNotMatch(nav, /Eksper–Sigorta İlişkileri/);
    assert.match(nav, /'\/panel\/ayarlar\/eksper-sigorta-iliskileri': '\/panel\/musteriler\?subType=eksper_firmasi'/);
    const page = readRel('app/panel/ayarlar/eksper-sigorta-iliskileri/page.tsx');
    assert.match(page, /SettingsLegacyRedirect/);
    assert.match(page, /subType=eksper_firmasi/);
    assert.doesNotMatch(page, /type=["']checkbox["']/);
  });

  it('müşteri kartı ve CRM dosyadan tanınan ilişkiyi basar', () => {
    const detail = readRel('app/panel/musteriler/[id]/page.tsx');
    assert.match(detail, /FileRecognizedPartners/);
    const crm = readRel('app/panel/crm/page.tsx');
    assert.match(crm, /FileRecognizedPartners/);
    const svc = readFileSync(
      join(here, '../../../backend/src/modules/customers/customers.service.ts'),
      'utf8',
    );
    assert.match(svc, /resolveFileRecognizedPartners/);
    assert.doesNotMatch(svc, /eksper-sigorta bağlantı ayarlarında/);
  });
});
