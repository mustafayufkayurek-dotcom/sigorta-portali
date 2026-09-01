/**
 * Kısmi müşteri kaydı Kısa Ad’ı silmez. Boş liste hücresi unvan basmaz.
 * Çalıştır: node --experimental-strip-types --test apps/backend/src/modules/customers/customer-short-name.lock.spec.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const service = readFileSync(join(here, 'customers.service.ts'), 'utf8');
const assistance = readFileSync(
  join(here, '../../../../../apps/web/src/app/panel/ayarlar/sigorta-sirketleri/page.tsx'),
  'utf8',
);
const detail = readFileSync(
  join(here, '../../../../../apps/web/src/app/panel/musteriler/[id]/page.tsx'),
  'utf8',
);
const sql = readFileSync(
  join(here, '../../../../../scripts/repair-customer-short-name-backfill.sql'),
  'utf8',
);

describe('müşteri kısa ad LOCK', () => {
  it('kısmi PATCH mevcut Kısa Ad’ı korur', () => {
    assert.match(service, /keepExistingShortName/);
    assert.match(service, /assertShortNameRequired/);
    assert.match(service, /existing\.shortName/);
  });

  it('asistans kaydı Kısa Ad gönderir', () => {
    assert.match(assistance, /shortName: String\(editingAssistance\?\.shortName/);
  });

  it('kartta Kısa Ad satırı durur', () => {
    assert.match(detail, /label="Kısa Ad"/);
  });

  it('geri doldurma yalnız boş Kısa Ad’a yazar', () => {
    assert.match(sql, /WHERE \(short_name IS NULL OR btrim\(short_name\) = ''\)/);
    assert.match(sql, /SET short_name = btrim\(COALESCE\(company_name/);
    assert.doesNotMatch(sql, /SET short_name = NULL/);
  });
});
