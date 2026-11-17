/**
 * Masraf Dosyadan Seç — SlidePanel üstünde net açılır (flu kesilir).
 * Çalıştır: node --experimental-strip-types --test apps/web/src/components/finance/expense-file-picker.lock.spec.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));

describe('masraf dosya seç modal LOCK', () => {
  it('portal ile SlidePanel üstünde açılır; blur yok', () => {
    const modal = readFileSync(join(here, 'ExpenseFilePickerModal.tsx'), 'utf8');
    const panel = readFileSync(join(here, '../SlidePanel.tsx'), 'utf8');
    assert.match(modal, /createPortal/);
    assert.match(modal, /masraf-dosya-sec-modal/);
    assert.match(modal, /z-\[420\]/);
    assert.doesNotMatch(modal, /backdrop-blur/);
    assert.doesNotMatch(modal, /z-\[60\]/);
    assert.match(panel, /z-\[200\]/);
    assert.match(panel, /z-\[210\]/);
  });

  it('bütçe durumu balon değil kurumsal metindir', () => {
    const modal = readFileSync(join(here, 'ExpenseFilePickerModal.tsx'), 'utf8');
    assert.match(modal, /masraf-dosya-butce-durum/);
    assert.doesNotMatch(modal, /rounded-full/);
    assert.doesNotMatch(modal, /bg-emerald-100/);
    assert.doesNotMatch(modal, /bg-amber-100/);
    assert.match(modal, /Dosya bütçesi hazır/);
    assert.match(modal, /Bütçe onayı yok/);
  });
});
