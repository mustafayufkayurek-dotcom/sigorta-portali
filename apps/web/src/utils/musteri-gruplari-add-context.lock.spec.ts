/**
 * Yeni Özel Müşteri — bireysel kart, firma tipi değil.
 * Çalıştır: node --experimental-strip-types --test apps/web/src/utils/musteri-gruplari-add-context.lock.spec.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  entityTypeForMusteriAdd,
  isYeniDosyaOzelMusteriAdd,
  OZEL_MUSTERI_SUB_TYPE,
} from './musteri-gruplari-add-context.ts';

const here = dirname(fileURLToPath(import.meta.url));

describe('yeni özel müşteri kartı kilidi', () => {
  it('özel müşteri bireyseldir; Yeni Dosya dönüşü tanınır', () => {
    assert.equal(OZEL_MUSTERI_SUB_TYPE, 'private_customer');
    assert.equal(entityTypeForMusteriAdd('private_customer', 'corporate'), 'individual');
    assert.equal(entityTypeForMusteriAdd('eksper_firmasi', 'corporate'), 'corporate');
    assert.equal(
      isYeniDosyaOzelMusteriAdd({
        returnTo: '/panel/hasar-dosyalari?yeni=1',
        subType: 'private_customer',
      }),
      true,
    );
  });

  it('Yeni Özel Müşteri formu bireysel Özel Müşteri ile açılır', () => {
    const form = readFileSync(join(here, '../components/claim-files/ClaimNewForm.tsx'), 'utf8');
    const page = readFileSync(join(here, '../app/panel/musteriler/page.tsx'), 'utf8');
    assert.match(form, /subType: 'private_customer'/);
    assert.match(form, /entityType: 'individual'/);
    assert.match(page, /isYeniDosyaOzelMusteriAdd/);
    assert.match(page, /Özel müşteri bireysel kişidir/);
    assert.match(page, /\? 'Özel Müşteri'/);
  });
});
