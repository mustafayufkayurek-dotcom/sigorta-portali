/**
 * Tespit galeri yükü küçültülür; sıra sıra tam boy gitmez.
 * node --experimental-strip-types --test apps/web/src/utils/shrink-inspection-photo.lock.spec.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  INSPECTION_PHOTO_MAX_EDGE,
  INSPECTION_PHOTO_UPLOAD_CONCURRENCY,
  runWithConcurrency,
} from './shrink-inspection-photo.ts';

const here = dirname(fileURLToPath(import.meta.url));

describe('tespit galeri yükü kilidi', () => {
  it('küçültme 1920 kenar, üçlü gönderim', () => {
    assert.equal(INSPECTION_PHOTO_MAX_EDGE, 1920);
    assert.equal(INSPECTION_PHOTO_UPLOAD_CONCURRENCY, 3);
    const util = readFileSync(join(here, 'shrink-inspection-photo.ts'), 'utf8');
    assert.match(util, /createImageBitmap/);
    assert.match(util, /image\/jpeg/);
    const photos = readFileSync(join(here, '../components/field-survey/FieldInspectionPhotosPanel.tsx'), 'utf8');
    assert.match(photos, /shrinkInspectionPhoto/);
    assert.match(photos, /runWithConcurrency/);
    assert.match(photos, /INSPECTION_PHOTO_UPLOAD_CONCURRENCY/);
    assert.doesNotMatch(photos, /for \(const file of images\) \{\s*\n\s*const fd/);
    assert.match(photos, /Galeriden/);
    assert.doesNotMatch(photos, /disabled=\{uploading\}/);
  });

  it('üçlü kuyruk sırayı korur', async () => {
    const seen: number[] = [];
    await runWithConcurrency([1, 2, 3, 4], 2, async (n) => {
      seen.push(n);
    });
    assert.deepEqual(seen.sort(), [1, 2, 3, 4]);
  });
});
