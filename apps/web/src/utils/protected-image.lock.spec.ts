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
    assert.match(photos, /PhotoLightbox/);
    assert.doesNotMatch(photos, /responseType: 'blob'/);
    const lightbox = read('../components/ui/PhotoLightbox.tsx');
    assert.match(lightbox, /createPortal/);
    assert.match(lightbox, /document\.body/);
    assert.match(lightbox, /foto-lightbox-onceki/);
    assert.match(lightbox, /foto-lightbox-sonraki/);
    assert.match(lightbox, /flex w-full items-center justify-center gap-3/);
    assert.doesNotMatch(lightbox, /absolute left-2 top-1\/2/);
    const gallery = read('../components/damage-reports/ReportImageGallery.tsx');
    assert.match(gallery, /rapor-foto-onceki/);
    assert.match(gallery, /rapor-foto-sonraki/);
    assert.match(gallery, /wrapReadyIndex/);
    const closure = read('../components/file-documents/ClosurePhotosPanel.tsx');
    assert.match(closure, /AuthBlobImg/);
    assert.match(closure, /PhotoLightbox/);
  });
});
