/**
 * Kilit: Resim gösterimi 302 MinIO’ya gitmez; oturumla bayt akar.
 * node --experimental-strip-types --test apps/backend/src/modules/entity-documents/entity-document-stream.lock.spec.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));

describe('entity-document stream LOCK', () => {
  it('file ve download bayt gönderir; 302 yok', () => {
    const ctl = readFileSync(join(here, 'entity-documents.controller.ts'), 'utf8');
    assert.match(ctl, /@Get\(':id\/file'\)/);
    assert.match(ctl, /getFileBuffer/);
    assert.match(ctl, /res\.send\(buffer\)/);
    assert.doesNotMatch(ctl, /res\.redirect\(302/);
    const svc = readFileSync(join(here, 'entity-documents.service.ts'), 'utf8');
    assert.match(svc, /async getFileBuffer/);
    assert.match(svc, /storage\.download/);
  });

  it('vendor ve uploads aynı akışı kullanır', () => {
    const vendor = readFileSync(join(here, '../vendor-documents/vendor-documents.controller.ts'), 'utf8');
    assert.match(vendor, /vendor-documents\/:id\/file/);
    assert.doesNotMatch(vendor, /res\.redirect\(302/);
    const uploads = readFileSync(join(here, '../uploads/uploads.controller.ts'), 'utf8');
    assert.match(uploads, /@Get\('file'\)/);
    assert.match(uploads, /res\.send\(buffer\)/);
    const full = readFileSync(join(here, '../../../../../scripts/deploy-full-production.sh'), 'utf8');
    const web = readFileSync(join(here, '../../../../../scripts/deploy-web-production.sh'), 'utf8');
    assert.match(full, /smoke-resim-akis\.sh/);
    assert.match(web, /smoke-resim-akis\.sh/);
  });
});
