/**
 * Kilit: Hasar fiziki evrak MinIO adresi açılmaz; oturumla bayt.
 * Çalıştır: node --experimental-strip-types --test apps/backend/src/modules/file-documents/file-document-physical-stream.lock.spec.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));

describe('file-document physical stream LOCK', () => {
  it('physical-file bayt gönderir; imzalı MinIO yok', () => {
    const ctl = readFileSync(join(here, 'file-documents.controller.ts'), 'utf8');
    const svc = readFileSync(join(here, 'file-documents.service.ts'), 'utf8');
    assert.match(ctl, /@Get\(':id\/physical-file'\)/);
    assert.match(ctl, /getPhysicalFileBuffer/);
    assert.match(ctl, /res\.send\(buffer\)/);
    assert.doesNotMatch(ctl, /res\.redirect\(302/);
    assert.match(svc, /storage\.download/);
    assert.doesNotMatch(svc, /getPhysicalFileUrl/);
    assert.doesNotMatch(svc, /getSignedUrl\(doc\.physicalUploadKey/);
  });
});
