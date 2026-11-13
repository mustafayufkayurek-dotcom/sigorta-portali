/**
 * Revizyon eski raporun resmini aynı dosyayla taşır. Revizyondan resim silinince
 * eski raporun resmi diskten gitmez.
 * Çalıştır: node --experimental-strip-types --test apps/backend/src/modules/repair-reports/report-image-shared-key.lock.spec.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '../../../../..');

function deleteImageBody(src: string): string {
  const start = src.indexOf('async deleteImage(');
  assert.ok(start > 0, 'deleteImage bulunamadı');
  const end = src.indexOf('async streamImageFile(', start);
  return src.slice(start, end > start ? end : start + 2000);
}

describe('rapor resmi ortak dosya LOCK', () => {
  it('başka kayıt kullanırken dosya diskten silinmez', () => {
    const src = readFileSync(join(here, 'repair-reports.service.ts'), 'utf8');
    const body = deleteImageBody(src);
    assert.match(body, /reportImage\.count\(/);
    assert.match(body, /storageKey: key/);
    assert.match(body, /annotatedKey: key/);
    assert.match(body, /stillUsed > 0\) continue/);
    const countAt = body.indexOf('reportImage.count(');
    const unlinkAt = body.indexOf('unlinkSync');
    assert.ok(countAt > 0 && unlinkAt > countAt, 'sayım silmeden önce yapılır');
  });

  it('revizyon resmi aynı anahtarla taşır (kilidin gerekçesi)', () => {
    const src = readFileSync(join(here, 'repair-reports.service.ts'), 'utf8');
    assert.match(src, /storageKey: img\.storageKey/);
  });

  it('canlı alım kapısında durur', () => {
    const smoke = readFileSync(join(root, 'scripts/smoke-canli-bitmis-is.sh'), 'utf8');
    assert.match(smoke, /report-image-shared-key\.lock\.spec/);
  });
});
