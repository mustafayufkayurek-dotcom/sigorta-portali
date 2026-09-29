/**
 * Kilit: Müşteri açık adresi mahalle/cadde ile üst üste binmez; tekrarlı satır bir kez durur.
 * Çalıştır: node --experimental-strip-types --test apps/web/src/utils/customer-open-address.lock.spec.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  collapseRepeatedAddressLine,
  customerCardOpenAddress,
} from './customer-open-address.ts';

const here = dirname(fileURLToPath(import.meta.url));
const unit =
  'Maslak, Büyükdere Cd. Noramin İş Merkezi No:237 316, 34398 Sarıyer/İstanbul';

describe('müşteri açık adres LOCK', () => {
  it('tekrarlanan cümleyi bir kez bırakır', () => {
    assert.equal(collapseRepeatedAddressLine(Array(5).fill(unit).join(' ')), unit);
    assert.equal(collapseRepeatedAddressLine(Array(4).fill(unit).join(' ')), unit);
    assert.equal(collapseRepeatedAddressLine(unit), unit);
  });

  it('mahalle ile aynıysa açık adresi gizler', () => {
    const bloated = Array(4).fill(unit).join(' ');
    assert.equal(
      customerCardOpenAddress({ address: bloated, neighborhood: unit, streetName: '' }),
      '',
    );
    assert.equal(
      customerCardOpenAddress({
        address: 'Kat 3, kapı kodu 12',
        neighborhood: unit,
        streetName: '',
      }),
      'Kat 3, kapı kodu 12',
    );
  });

  it('kayıt mahalle ve caddeyi açık adrese yapıştırmaz', () => {
    const page = readFileSync(join(here, '../app/panel/musteriler/page.tsx'), 'utf8');
    assert.doesNotMatch(page, /address: computedAddress/);
    assert.match(page, /customerCardOpenAddress/);
    const detail = readFileSync(join(here, '../app/panel/musteriler/[id]/page.tsx'), 'utf8');
    assert.match(detail, /customerCardOpenAddress/);
    assert.match(detail, /openAddressLine/);
  });
});
