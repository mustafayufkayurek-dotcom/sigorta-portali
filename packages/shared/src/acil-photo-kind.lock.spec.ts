/**
 * Acil tespit / hizmet sonrası resmi ayrımı.
 * Çalıştır: node --experimental-strip-types --test packages/shared/src/acil-photo-kind.lock.spec.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  ACIL_AFTER_SERVICE_PHOTO_NOTE,
  isAcilAfterServicePhotoNotes,
  isAcilInspectionPhotoNotes,
} from './acil-photo-kind.ts';

const here = dirname(fileURLToPath(import.meta.url));

describe('acil resim türü LOCK', () => {
  it('hizmet sonrası kapanış notes’unu tespit kutusundan ayırır', () => {
    assert.equal(isAcilAfterServicePhotoNotes(ACIL_AFTER_SERVICE_PHOTO_NOTE), true);
    assert.equal(isAcilAfterServicePhotoNotes('Dosya Kapanış Resmi'), true);
    assert.equal(isAcilAfterServicePhotoNotes('Tespit Fotoğrafı'), false);
    assert.equal(isAcilInspectionPhotoNotes('Tespit Fotoğrafı'), true);
    assert.equal(isAcilInspectionPhotoNotes('Dosya Kapanış Resmi'), false);
    assert.equal(isAcilInspectionPhotoNotes(''), true);
  });

  it('kapanış PDF ve kutu aynı etiket ailesini kullanır', () => {
    const html = readFileSync(
      join(here, '../../../apps/backend/src/modules/emergency/acil-approval-report-html.ts'),
      'utf8',
    );
    const panel = readFileSync(
      join(here, '../../../apps/web/src/components/file-documents/ClosurePhotosPanel.tsx'),
      'utf8',
    );
    const inspect = readFileSync(
      join(here, '../../../apps/web/src/components/field-survey/FieldInspectionPhotosPanel.tsx'),
      'utf8',
    );
    assert.match(html, /Hizmet Sonrası Resimleri/);
    assert.match(panel, /Hizmet Sonrası Resimleri/);
    assert.match(panel, /ACIL_AFTER_SERVICE_PHOTO_NOTE/);
    assert.match(inspect, /isAcilInspectionPhotoNotes/);
  });
});
