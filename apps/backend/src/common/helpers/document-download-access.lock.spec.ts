/**
 * Çalıştır: node --experimental-strip-types --test \
 *   apps/backend/src/common/helpers/document-download-access.lock.spec.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const read = (rel: string) => readFileSync(join(here, rel), 'utf8');

describe('evrak indirme sahiplik LOCK', () => {
  it('saha Acil sahipliği atanan kişiyle sınırlıdır', () => {
    const helper = read('./document-download-access.ts');
    assert.match(helper, /assignedFieldUserId === userId \|\| row\.assignedUserId === userId/);
    assert.match(helper, /DOCUMENT_DOWNLOAD_NOT_FOUND = 'Evrak bulunamadı'/);
    assert.match(helper, /assertClaimFileAccess/);
    assert.match(helper, /insuranceCompanyId: \{ in: insuranceCompanyIds \}/);
    assert.match(helper, /silentDocumentDownloadDeny/);
  });

  it('fotoğraf ve evrak kapıları sahipliği sorar; genel indirme anahtarsız gitmez', () => {
    const entity = read('../../modules/entity-documents/entity-documents.service.ts');
    assert.match(entity, /assertScopedFileEntityAccess/);
    assert.match(entity, /rethrowDownloadAccess/);
    const files = read('../../modules/file-documents/file-documents.service.ts');
    assert.match(files, /assertScopedFileEntityAccess/);
    assert.match(files, /isFieldStaff/);
    assert.match(files, /fieldStaffMayDownloadEntityType/);
    const uploads = read('../../modules/uploads/uploads.service.ts');
    assert.match(uploads, /assertStorageKeyDownloadAccess/);
    assert.match(uploads, /isSafeStorageKey/);
    assert.match(uploads, /silentDocumentDownloadDeny/);
    const ctl = read('../../modules/uploads/uploads.controller.ts');
    assert.match(ctl, /@CurrentUser\(\) user/);
    assert.match(ctl, /getFileBuffer\(storageKey, user\)/);
    assert.doesNotMatch(ctl, /res\.redirect\(302/);
  });
});
