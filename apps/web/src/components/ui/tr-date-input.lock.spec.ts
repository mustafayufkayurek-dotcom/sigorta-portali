/**
 * Tarih kutusu GG.AA.YYYY yazınca tarayıcı kırmızı çerçeve basmasın.
 * Çalıştır: node --experimental-strip-types --test apps/web/src/components/ui/tr-date-input.lock.spec.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(join(here, 'TrDateInput.tsx'), 'utf8');
const tahsilat = readFileSync(
  join(here, '../finance/ClaimFileGelirTahsilatPanel.tsx'),
  'utf8',
);

describe('tarih kutusu kırmızı çerçeve LOCK', () => {
  it('metin tarihi sayısal inputMode ile doğrulatmaz', () => {
    assert.doesNotMatch(src, /inputMode="numeric"/);
    assert.match(src, /autoComplete="off"/);
    assert.match(src, /spellCheck=\{false\}/);
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
