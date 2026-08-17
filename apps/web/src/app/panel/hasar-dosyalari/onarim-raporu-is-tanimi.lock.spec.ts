/**
 * Kilit: hasar raporu — iş grubu altına iş tanımı ekleme kaybolmasın.
 * Çalıştır: node --experimental-strip-types --test apps/web/src/app/panel/hasar-dosyalari/onarim-raporu-is-tanimi.lock.spec.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const specDir = dirname(fileURLToPath(import.meta.url));
const page = readFileSync(
  join(specDir, '[id]/onarim-raporu/[reportId]/page.tsx'),
  'utf8',
);

describe('onarim-raporu iş tanımı LOCK', () => {
  it('WorkDefinitionSelector durur', () => {
    assert.match(page, /function WorkDefinitionSelector/);
  });

  it('listeden ve + düğmesinden yeni iş tanımı eklenir', () => {
    assert.match(page, /\+ Yeni İş Tanımı Ekle/);
    assert.match(page, /aria-label="Yeni İş Tanımı Ekle"/);
    assert.match(page, /onAddNew=\{createSubGroup\}/);
  });

  it('kayıt iş grubu alt grup API’sine gider; hata yutulmaz', () => {
    assert.match(page, /work-groups\/\$\{workGroupId\}\/sub-groups/);
    const selector = page.slice(
      page.indexOf('function WorkDefinitionSelector'),
      page.indexOf('function DetectionScopeSelector'),
    );
    assert.match(selector, /İş tanımı eklenemedi/);
    assert.doesNotMatch(selector, /catch \{ \/\* ignore \*\/ \}/);
  });
});
