/**
 * Onarım raporu fotoğraf çerçevesi + yükleme URL kilidi.
 * Çalıştır: npx tsx --test src/utils/report-image-gallery.lock.spec.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import { formatReportImageFrameLabel } from './report-image-frame-label';
import { getReportImageUrl } from './upload-url';

const webRoot = join(__dirname, '..');

function read(rel: string): string {
  return readFileSync(join(webRoot, rel), 'utf8');
}

describe('report-image-gallery LOCK', () => {
  it('çerçeve etiketi DosyaNo/Kategori formatındadır', () => {
    assert.equal(formatReportImageFrameLabel('123456', 'before'), '123456/Tespit Resimleri');
    assert.equal(formatReportImageFrameLabel('123456', 'damage'), '123456/Onarım Resimleri');
    assert.equal(formatReportImageFrameLabel('123456', 'after'), '123456/Onarım Sonrası Resimleri');
  });

  it('galeri CategoryBadge kullanmaz; formatReportImageFrameLabel + fileNo prop kullanır', () => {
    const gallery = read('components/damage-reports/ReportImageGallery.tsx');
    assert.doesNotMatch(gallery, /function CategoryBadge/);
    assert.doesNotMatch(gallery, /reportImageCategoryColor/);
    assert.doesNotMatch(gallery, /REPORT_IMAGE_CATEGORY_COLORS/);
    assert.match(gallery, /formatReportImageFrameLabel/);
    assert.match(gallery, /fileNo\?:/);
  });

  it('kategori renk yardımcısı kaldırıldı (ölü rozet yolu)', () => {
    const types = read('utils/quick-repair-damage-types.ts');
    assert.doesNotMatch(types, /REPORT_IMAGE_CATEGORY_COLORS/);
    assert.doesNotMatch(types, /reportImageCategoryColor/);
  });

  it('getReportImageUrl tarayıcı origin kullanmaz (web/API port ayrımı)', () => {
    const src = read('utils/upload-url.ts');
    assert.doesNotMatch(src, /return\s+`\$\{window\.location\.origin\}/);
    assert.doesNotMatch(src, /window\.location\.origin\s*\+/);
    assert.match(src, /getUploadsBaseUrl\(\)/);
    const url = getReportImageUrl('abc.jpg');
    assert.match(url, /uploads\/report-images/);
    assert.doesNotMatch(url, /undefined/);
  });

  it('onarım raporu sayfası galeriye fileNo verir', () => {
    const page = read('app/panel/hasar-dosyalari/[id]/onarim-raporu/[reportId]/page.tsx');
    assert.match(page, /fileNo=\{[^}]*fileNo/);
  });
});
