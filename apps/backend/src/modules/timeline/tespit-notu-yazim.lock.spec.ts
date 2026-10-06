/**
 * Tespit notu kaydı düzensiz klavyeyi Title Case çeker.
 * Çalıştır: node --experimental-strip-types --test apps/backend/src/modules/timeline/tespit-notu-yazim.lock.spec.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { toTitleCaseTR } from '../../common/utils/text-helpers.ts';

const here = dirname(fileURLToPath(import.meta.url));

describe('tespit notu yazım LOCK', () => {
  it('İNCEleme kayıtta İnceleme olur', () => {
    assert.equal(
      toTitleCaseTR('Konutta yapılan İNCEleme esnasında'),
      'Konutta Yapılan İnceleme Esnasında',
    );
    const svc = readFileSync(join(here, 'timeline.service.ts'), 'utf8');
    assert.match(svc, /const written = toTitleCaseTR/);
    assert.match(svc, /async updateNote/);
    const ctrl = readFileSync(join(here, 'timeline.controller.ts'), 'utf8');
    assert.match(ctrl, /@Patch\(':id\/notes\/:noteId'\)/);
    const notes = readFileSync(join(here, '../notes/notes.service.ts'), 'utf8');
    assert.match(notes, /toTitleCaseTR\(payload\.content/);
  });
});
