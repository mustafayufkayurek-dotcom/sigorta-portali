/**
 * Eksik rapor fotoğrafı yedekten gelir; mevcut dosya ezilmez.
 * Çalıştır: node --experimental-strip-types --test scripts/restore-missing-report-images.lock.spec.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));

describe('eksik rapor fotoğrafı geri koyma LOCK', () => {
  it('üzerine yazmaz; sahte resim üretmez; canlı alım kapısında durur', () => {
    const src = readFileSync(join(here, 'restore-missing-report-images.sh'), 'utf8');
    assert.match(src, /--skip-old-files/);
    assert.match(src, /cp -n/);
    assert.doesNotMatch(src, /convert |ffmpeg |placeholder/i);
    assert.match(src, /report_images/);
    const smoke = readFileSync(join(here, 'smoke-canli-bitmis-is.sh'), 'utf8');
    assert.match(smoke, /restore-missing-report-images\.lock\.spec/);
  });
});
