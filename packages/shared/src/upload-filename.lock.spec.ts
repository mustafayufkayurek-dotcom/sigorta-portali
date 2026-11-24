/**
 * Çalıştır: node --experimental-strip-types --test packages/shared/src/upload-filename.lock.spec.ts
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  decodeMulterOriginalName,
  displayUploadFilename,
} from './upload-filename.ts';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '../../..');

describe('yükleme dosya adı LOCK', () => {
  it('UTF-8 dosya adını latin1 mojibake’den geri çeker', () => {
    const correct = 'tedarikçi kayıt formu.pdf';
    const mojibake = Buffer.from(correct, 'utf8').toString('latin1');
    assert.equal(mojibake.includes('Ã'), true);
    assert.equal(decodeMulterOriginalName(mojibake), correct);
    assert.equal(displayUploadFilename(mojibake), correct);
    assert.equal(decodeMulterOriginalName('fatura.pdf'), 'fatura.pdf');
    assert.equal(decodeMulterOriginalName(''), 'dosya');
  });

  it('tedarikçi evrak kaydı ve ekranı decode kullanır', () => {
    const svc = readFileSync(
      join(root, 'apps/backend/src/modules/vendor-documents/vendor-documents.service.ts'),
      'utf8',
    );
    const detail = readFileSync(
      join(root, 'apps/web/src/app/panel/tedarikciler/[id]/page.tsx'),
      'utf8',
    );
    const searchable = readFileSync(
      join(root, 'apps/web/src/components/ui/SearchableSelect.tsx'),
      'utf8',
    );
    assert.match(svc, /decodeMulterOriginalName/);
    assert.match(detail, /displayUploadFilename|decodeMulterOriginalName/);
    // Tab odaklanınca açılır liste açılmaz
    assert.match(searchable, /onFocus=\{/);
    assert.doesNotMatch(
      searchable,
      /onFocus=\{[\s\S]{0,120}setOpen\(true\)/,
      'Tab ile odaklanınca SearchableSelect açılmaz',
    );
    assert.match(searchable, /onClick=\{[\s\S]{0,200}setOpen\(true\)/);
  });
});
