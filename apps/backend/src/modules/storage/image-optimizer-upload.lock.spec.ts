/**
 * Kilit: kapanış/tespit resmi yüklerken çevirme işlemi düşmez.
 * node --experimental-strip-types --test apps/backend/src/modules/storage/image-optimizer-upload.lock.spec.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));

describe('acil resim yükleme LOCK', () => {
  it('optimizeImage yüklemede orientPhotoBuffer çağırmaz', () => {
    const opt = readFileSync(join(here, 'image-optimizer.service.ts'), 'utf8');
    assert.doesNotMatch(opt, /orientPhotoBuffer/);
    assert.match(opt, /async optimizeImage/);
    assert.match(opt, /async generateThumbnail/);
  });

  it('işleme düşse de asıl dosya yazılır', () => {
    const svc = readFileSync(join(here, '../entity-documents/entity-documents.service.ts'), 'utf8');
    assert.match(svc, /image process fallback/);
    assert.match(svc, /storage\.upload\(file\.buffer/);
    assert.match(svc, /POST|create\(/);
  });

  it('kapanış ekranı entity-documents’e resim gönderir', () => {
    const photos = readFileSync(
      join(here, '../../../../../apps/web/src/components/field-survey/FieldInspectionPhotosPanel.tsx'),
      'utf8',
    );
    assert.match(photos, /axios\.post\(`\$\{API\}\/entity-documents`/);
    assert.match(photos, /Galeriden/);
    assert.match(photos, /Kameradan/);
  });
});
