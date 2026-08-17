/**
 * Rapor fotoğraf disk yolu kilidi — cwd sapması «Yüklenemedi» üretmesin.
 * Çalıştır: npx tsx --test src/modules/repair-reports/report-image-paths.lock.spec.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';

const root = join(__dirname);

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
    const main = readFileSync(join(__dirname, '../../main.ts'), 'utf8');
    assert.match(main, /getUploadsRootDir/);
    assert.doesNotMatch(main, /useStaticAssets\(join\(process\.cwd\(\),\s*'uploads'\)/);
  });

  it('getUploadsRootDir export edilir', () => {
    const paths = read('report-image-paths.ts');
    assert.match(paths, /export function getUploadsRootDir/);
    assert.match(paths, /REPORT_IMAGES_DIR/);
  });
});
