/**
 * Rapor fotoğraf disk yolu kilidi — cwd sapması «Yüklenemedi» üretmesin.
 * Çalıştır: npx tsx --test src/modules/repair-reports/report-image-paths.lock.spec.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));

function read(rel: string): string {
  return readFileSync(join(root, rel), 'utf8');
}

describe('report-image-paths LOCK', () => {
  it('controller multer getReportImagesDir kullanır', () => {
    const ctrl = read('repair-reports.controller.ts');
    assert.match(ctrl, /getReportImagesDir/);
    assert.doesNotMatch(
      ctrl,
      /join\(process\.cwd\(\),\s*'uploads',\s*'report-images'\)/,
    );
  });

  it('service stream/delete resolveReportImageFilePath kullanır; annotasyon yoksa orijinale düşer', () => {
    const svc = read('repair-reports.service.ts');
    assert.match(svc, /resolveReportImageFilePath/);
    assert.match(svc, /Annotasyon dosyası kayıpsa orijinale düş/);
    assert.doesNotMatch(
      svc,
      /path\.join\(this\.uploadDir,\s*path\.basename\(key\)\)/,
    );
  });

  it('main ServeStatic getUploadsRootDir kullanır', () => {
    const main = readFileSync(join(root, '../../main.ts'), 'utf8');
    assert.match(main, /getUploadsRootDir/);
    assert.doesNotMatch(main, /useStaticAssets\(join\(process\.cwd\(\),\s*'uploads'\)/);
  });

  it('saha tespit resmi rapor altına bağlanır', () => {
    const svc = read('repair-reports.service.ts');
    assert.match(svc, /attachClaimInspectionPhotosToReport/);
    assert.match(svc, /isHasarTespitPhotoNotes/);
    assert.match(svc, /ACIL_INSPECTION_PHOTO_NOTE/);
    assert.doesNotMatch(svc.slice(svc.indexOf('private async getReportForPdf')), /attachClaimInspectionPhotosToReport/);
  });

  it('Hasar PDF sorgusu dosyada olmayan fileDate istemez', () => {
    const svc = read('repair-reports.service.ts');
    const select = svc.slice(svc.indexOf('const CLAIM_FILE_SAFE_SELECT'), svc.indexOf('const REPORT_INCLUDE_CORE'));
    assert.match(select, /notificationDate: true/);
    assert.doesNotMatch(select, /fileDate/);
  });

  it('webp ve png PDF içine jpeg olarak girer; küçük dosya olduğu gibi gömülmez', () => {
    const paths = read('report-image-paths.ts');
    const fn = paths.slice(paths.indexOf('export async function reportImageToPdfDataUrl'));
    assert.match(fn, /isJpegMime\(mime\)/);
    assert.match(fn, /data:image\/jpeg;base64/);
    assert.doesNotMatch(fn, /return reportImageToDataUrl/);
    const svc = read('repair-reports.service.ts');
    assert.match(svc, /externalMailPdf/);
    assert.match(svc, /REPAIR_REPORT_MAIL_INLINE_MAX_BYTES/);
  });

  it('getUploadsRootDir export edilir', () => {
    const paths = read('report-image-paths.ts');
    assert.match(paths, /export function getUploadsRootDir/);
    assert.match(paths, /REPORT_IMAGES_DIR/);
  });
});
