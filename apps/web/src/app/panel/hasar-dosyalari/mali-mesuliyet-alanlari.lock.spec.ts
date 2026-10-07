/**
 * Mali mesuliyet raporda MM; dijital muvafakatta mağdur.
 * Çalıştır: node --experimental-strip-types --test \
 *   apps/web/src/app/panel/hasar-dosyalari/mali-mesuliyet-alanlari.lock.spec.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const page = readFileSync(join(here, '[id]/page.tsx'), 'utf8');
const rapor = readFileSync(join(here, '[id]/onarim-raporu/[reportId]/page.tsx'), 'utf8');
const steps = readFileSync(
  join(here, '../../../components/hasar-operasyon-planlayicisi/steps.tsx'),
  'utf8',
);
const documents = readFileSync(
  join(here, '../../../../../backend/src/modules/file-documents/file-documents.service.ts'),
  'utf8',
);

describe('mali mesuliyet rapor ve muvafakat LOCK', () => {
  it('dosya sayfasında ayrı alan paneli ve taslak durmaz', () => {
    assert.doesNotMatch(page, /MaliMesuliyetAlanlariPanel/);
    assert.doesNotMatch(page, /MaliMesuliyetMuvafakatTaslagi/);
    assert.doesNotMatch(page, /Mali Mesuliyet Alanları/);
    assert.doesNotMatch(page, /Muvafakat Taslağı/);
    assert.match(page, /FieldStaffEndInspection/);
    assert.match(page, /ofis-saha-tespit/);
  });

  it('rapor MM satırında lokasyon ve daire no durur', () => {
    assert.match(rapor, /function MmMahalInput/);
    assert.match(rapor, /mm-mahal-alan/);
    assert.match(rapor, /MALI_MESULIYET_LOKASYON/);
    assert.match(rapor, /\+ Yeni Mahal\/Bölge Ekle/);
    assert.match(rapor, /Örn\. alt kat - daire 5/);
    assert.match(rapor, /claim-locations\/bind/);
    assert.match(rapor, /overflow-hidden/);
    assert.match(rapor, /damageCategory === 'mm'/);
    assert.doesNotMatch(rapor, /uppercase/);
  });

  it('dijital onay canlı muvafakattır; mağdur MM kaleminden gelir', () => {
    assert.match(steps, /documentKind="muvafakatname"/);
    assert.match(steps, /hasar-mm-muvafakat-notu/);
    assert.match(steps, /Bu dosyada mali mesuliyet işi var/);
    assert.match(documents, /muvafakatShowsMagdur\(mmKalemler\.length, documentKind\)/);
    assert.match(documents, /damageCategory: 'mm'/);
    assert.doesNotMatch(documents, /maliMesuliyetTespit\.findMany/);
    assert.match(documents, /doc\.documentKind !== 'muvafakatname'/);
  });
});
