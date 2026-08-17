/**
 * Onarım raporu fotoğraf galerisi kilidi.
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
  it('etiket yardımcısı DosyaNo/Kategori formatındadır (lightbox alt metin)', () => {
    assert.equal(formatReportImageFrameLabel('123456', 'before'), '123456/Tespit Resimleri');
    assert.equal(formatReportImageFrameLabel('123456', 'damage'), '123456/Onarım Resimleri');
    assert.equal(formatReportImageFrameLabel('123456', 'after'), '123456/Onarım Sonrası Resimleri');
  });

  it('galeri CategoryBadge / FrameLabel kullanmaz; kayıp dosya için temizle bandı vardır', () => {
    const gallery = read('components/damage-reports/ReportImageGallery.tsx');
    assert.doesNotMatch(gallery, /function CategoryBadge/);
    assert.doesNotMatch(gallery, /function FrameLabel/);
    assert.doesNotMatch(gallery, /reportImageCategoryColor/);
    assert.match(gallery, /ONARIM_FOTOGRAF_KATEGORI_KILIT/);
    assert.match(gallery, /Kayıp Kayıtları Temizle/);
    assert.match(gallery, /onDeleteMany/);
    assert.match(gallery, /res\.status === 404/);
  });

  it('getReportImageUrl tarayıcı origin kullanmaz', () => {
    const src = read('utils/upload-url.ts');
    assert.doesNotMatch(src, /return\s+`\$\{window\.location\.origin\}/);
    assert.match(src, /getUploadsBaseUrl\(\)/);
    const url = getReportImageUrl('abc.jpg');
    assert.match(url, /uploads\/report-images/);
  });

  it('onarım raporu sayfası galeriye fileNo + onDeleteMany verir', () => {
    const page = read('app/panel/hasar-dosyalari/[id]/onarim-raporu/[reportId]/page.tsx');
    assert.match(page, /fileNo=\{[^}]*fileNo/);
    assert.match(page, /onDeleteMany=\{handleDeleteMissingImages\}/);
  });
});
