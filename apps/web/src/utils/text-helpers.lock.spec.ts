/**
 * Personel düzensiz klavye — Title Case.
 * Çalıştır: node --experimental-strip-types --test apps/web/src/utils/text-helpers.lock.spec.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));

describe('düzensiz klavye yazım LOCK', () => {
  it('tespit notu yazarken ve kaydederken Title Case çekilir', () => {
    const notes = readFileSync(
      join(here, '../app/panel/hasar-dosyalari/[id]/_components/tabs/IletisimGunluguPanel.tsx'),
      'utf8',
    );
    const helpers = readFileSync(join(here, 'text-helpers.ts'), 'utf8');
    assert.match(helpers, /export function toTitleCaseTR/);
    assert.match(helpers, /export function normalizeFormFreeText/);
    assert.match(notes, /normalizeFormFreeText\(content\)/);
    assert.match(notes, /toTitleCaseTR\(el\.value\)/);
    assert.match(notes, /fieldSavedNotes\.length === 0/);
    assert.match(notes, /claim-files\/\$\{claimId\}\/notes\/\$\{editingNoteId\}/);
    assert.doesNotMatch(notes, /collapseBody/);
  });
});
