/**
 * Kilit: Panel resmi imzalı URL / 302 ile değil, oturumlu akış + blob.
 * node --experimental-strip-types --test apps/web/src/utils/protected-image.lock.spec.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const read = (rel: string) => readFileSync(join(here, rel), 'utf8');

describe('protected-image LOCK', () => {
  it('akış URL üretir ve 302 takip etmez', () => {
    const util = read('protected-image.ts');
    assert.match(util, /redirect: 'manual'/);
    assert.match(util, /entity-documents\/\$\{id\}\/file/);
    assert.match(util, /uploads\/file\?storageKey=/);
    assert.match(util, /fetchAuthImageBlob/);
  });

  it('saha tespit ve kapanış resmi AuthBlobImg kullanır', () => {
    const photos = read('../components/field-survey/FieldInspectionPhotosPanel.tsx');
    assert.match(photos, /AuthBlobImg/);
    assert.match(photos, /entityDocumentFileUrl/);
    assert.match(photos, /h-36 w-36/);
    assert.doesNotMatch(photos, /responseType: 'blob'/);
    const closure = read('../components/file-documents/ClosurePhotosPanel.tsx');
    assert.match(closure, /AuthBlobImg/);
    assert.match(closure, /entityDocumentFileUrl/);
  });
});
