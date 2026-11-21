/**
 * Masraf dosya araması — sigortalı adı soyadı kelime kelime; listede sigortalı önde.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';

const root = join(import.meta.dirname, 'expenses.service.ts');

describe('Masraf dosya araması LOCK', () => {
  const src = readFileSync(root, 'utf8');

  it('Hasar listesi ad–soyad kapısını kullanır', () => {
    assert.match(src, /buildClaimFileListSearchWhere/);
    assert.match(src, /buildFileSearchFilter/);
  });

  it('listede önce sigortalı adı soyadı durur', () => {
    assert.match(src, /file\.insuredName \|\| customerName/);
    assert.doesNotMatch(src, /customerName \|\| file\.insuredName/);
  });
});
