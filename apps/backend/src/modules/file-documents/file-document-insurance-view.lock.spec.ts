/**
 * Kilit: Sigorta oturumuyla muvafakat view; 302 yok; token sızmaz.
 * Çalıştır: node --experimental-strip-types --test apps/backend/src/modules/file-documents/file-document-insurance-view.lock.spec.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));

describe('file-document insurance view LOCK', () => {
  it('view bayt gönderir; HTML veya fiziki', () => {
    const ctl = readFileSync(join(here, 'file-documents.controller.ts'), 'utf8');
    const svc = readFileSync(join(here, 'file-documents.service.ts'), 'utf8');
    assert.match(ctl, /@Get\(':id\/view'\)/);
    assert.match(ctl, /getStaffViewBuffer/);
    assert.match(ctl, /res\.send\(buffer\)/);
    assert.doesNotMatch(ctl, /res\.redirect\(302/);
    assert.match(svc, /getStaffViewBuffer/);
    assert.match(svc, /assertViewerAccess/);
    assert.match(svc, /hidePublicToken/);
  });
});
