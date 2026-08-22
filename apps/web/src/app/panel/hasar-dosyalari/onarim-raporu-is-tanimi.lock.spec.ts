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

  it('listeden yeni iş kalemi eklenir; satırda + yok', () => {
    const selector = page.slice(
      page.indexOf('function WorkDefinitionSelector'),
      page.indexOf('function DetectionScopeSelector'),
    );
    assert.match(selector, /\+ Yeni İş Kalemi Ekle/);
    assert.match(selector, /text-status-danger/);
    assert.match(page, /onAddNew=\{createSubGroup\}/);
    assert.doesNotMatch(selector, /aria-label="Yeni İş Tanımı Ekle"/);
  });

  it('iş grubu yokken uyarı kırmızı durur', () => {
    assert.match(page, /text-status-danger block py-3">Önce İş Grubu seçin/);
  });

  it('tanımlı iş tanımı yeniden eklenmez', () => {
    assert.match(page, /Bu iş tanımı zaten tanımlı/);
  });

  it('miktar hücresinde gölge hesapta onay ve iptal vardır', () => {
    assert.match(page, /shadowCalc/);
    assert.match(page, /aria-label="Onayla"/);
    assert.match(page, /aria-label="İptal"/);
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

  it('Acil rapor başlığı Taslak/Sunuldu ikilisi kullanmaz; gerçek aşama etiketi gösterir', () => {
    assert.doesNotMatch(page, /status === 'draft' \? 'Taslak' : 'Sunuldu'/);
    assert.match(page, /repairReportStatusLabel\(report\.status\)/);
  });
});
