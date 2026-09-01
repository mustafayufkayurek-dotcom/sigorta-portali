/**
 * Zorunlu açıklama — kutu içinde placeholder; yazınca kaybolur.
 * Çalıştır:
 *   node --experimental-strip-types --test apps/web/src/utils/aciklama-yardim.lock.spec.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { ACIKLAMA_YARDIM } from './aciklama-yardim.ts';

const here = dirname(fileURLToPath(import.meta.url));
const read = (rel: string) => readFileSync(join(here, rel), 'utf8');

describe('zorunlu açıklama yardım LOCK', () => {
  it('metin kutunun içinde placeholder durur; alt satır yoktur', () => {
    assert.equal(ACIKLAMA_YARDIM.avans, 'Avans Gerekçesini Açıklayınız.');
    assert.equal(ACIKLAMA_YARDIM.gelir, 'Gelir Kaydını Açıklayınız.');
    assert.equal(ACIKLAMA_YARDIM.masraf, 'Masraf Gerekçesini Açıklayınız.');
    assert.equal(ACIKLAMA_YARDIM.sozlesmeYok, 'Sözleşme Yokluğunu Açıklayınız.');
    const avans = read('../components/finance/HasarFileHakedisPanel.tsx');
    assert.match(avans, /placeholder=\{ACIKLAMA_YARDIM\.avans\}/);
    assert.match(avans, /placeholder=\{ACIKLAMA_YARDIM\.sozlesmeYok\}/);
    assert.doesNotMatch(avans, /hasar-avans-aciklama-yardim/);
    assert.doesNotMatch(avans, /setAvansAciklama\(avansAciklamaMetni/);
    const gelir = read('../components/finance/ClaimFileGelirTahsilatPanel.tsx');
    assert.match(gelir, /placeholder=\{ACIKLAMA_YARDIM\.gelir\}/);
    assert.doesNotMatch(gelir, /ACIKLAMA_YARDIM\.gelir\}<\/p>/);
    const masraf = read('../components/finance/ClaimFileExpenseFormPanel.tsx');
    assert.match(masraf, /placeholder=\{ACIKLAMA_YARDIM\.masraf\}/);
    assert.doesNotMatch(masraf, /ACIKLAMA_YARDIM\.masraf\}<\/p>/);
  });
});
