/**
 * Tarih kutusu: satıra odaklanınca klavyeden yazılır; takvim ikondan / ↓.
 * Çalıştır: node --experimental-strip-types --test apps/web/src/components/ui/tr-date-input.lock.spec.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  expandTrDateYearDigits,
  normalizeTrDateValue,
  trDateInputDisplayValue,
} from '../../utils/tr-date-input.ts';

const here = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(join(here, 'TrDateInput.tsx'), 'utf8');
const tahsilat = readFileSync(
  join(here, '../finance/ClaimFileGelirTahsilatPanel.tsx'),
  'utf8',
);

describe('tarih kutusu kırmızı çerçeve LOCK', () => {
  it('iki haneli yıl 20xx olur; dört haneli yıl bozulmaz', () => {
    assert.equal(expandTrDateYearDigits('051026'), '05102026');
    assert.equal(normalizeTrDateValue('05.10.26'), '2026-10-05');
    assert.equal(normalizeTrDateValue('05.10.2026'), '2026-10-05');
    assert.equal(trDateInputDisplayValue('05.10.26'), '05.10.2026');
  });

  it('klavye ile yazılır; yazım odakta draft tutar', () => {
    assert.doesNotMatch(src, /inputMode="numeric"/);
    assert.match(src, /inputMode="text"/);
    assert.match(src, /autoComplete="off"/);
    assert.match(src, /spellCheck=\{false\}/);
    assert.match(src, /handleTrDateInputChange/);
    assert.match(src, /tr-date-text/);
    assert.match(src, /tr-date-calendar/);
    assert.match(src, /Takvimden seç/);
    assert.match(src, /setFocused\(true\)/);
    assert.match(src, /setDraft/);
    assert.doesNotMatch(src, /nativeOverlay/);
    assert.doesNotMatch(src, /pointer: coarse/);
    // Odakta showPicker yok — yazımı bozmaz
    assert.doesNotMatch(src, /onFocus=\{\(\) => \{\s*setFocused\(true\);\s*openPicker/);
  });

  it('takvim ikondan ve ok tuşuyla açılır', () => {
    assert.match(src, /ArrowDown/);
    assert.match(src, /openPicker/);
    assert.match(src, /showPicker/);
    assert.match(src, /onMouseDown=\{\(e\) => \{/);
  });

  it('gizli type=date :invalid gölgesini basmaz', () => {
    assert.match(src, /\[&:invalid\]:shadow-none/);
    assert.match(src, /type="date"/);
  });

  it('yeni tahsilat tarayıcı doğrulamasını kapatır', () => {
    assert.match(tahsilat, /noValidate/);
    assert.match(tahsilat, /autoComplete="off"/);
    assert.match(tahsilat, /Tutar Sıfırdan Büyük Olmalıdır/);
    assert.match(tahsilat, /placeholder=""/);
  });

  it('fatura seçilmeden tahsilat boş invoiceId göndermez', () => {
    assert.match(tahsilat, /if \(!payload\.invoiceId\) delete payload\.invoiceId/);
  });
});
