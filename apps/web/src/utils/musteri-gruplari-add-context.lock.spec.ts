/**
 * Yeni Özel Müşteri — tam kart; bireysel sayfaya atlanmaz.
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
  it('özel müşteri tipi kilitli kalır; kurumsal veya bireysel seçilir', () => {
    assert.equal(OZEL_MUSTERI_SUB_TYPE, 'private_customer');
    assert.equal(entityTypeForMusteriAdd('private_customer', 'corporate'), 'corporate');
    assert.equal(entityTypeForMusteriAdd('private_customer', 'individual'), 'individual');
    assert.equal(entityTypeForMusteriAdd('private_customer', null), '');
    assert.equal(entityTypeForMusteriAdd('eksper_firmasi', 'corporate'), 'corporate');
    assert.equal(
      isYeniDosyaOzelMusteriAdd({
        returnTo: '/panel/hasar-dosyalari?yeni=1',
        subType: 'private_customer',
      }),
      true,
    );
  });

  it('Yeni Özel Müşteri bireysel forma atlamaz; tam kartta tip seçilir', () => {
    const form = readFileSync(join(here, '../components/claim-files/ClaimNewForm.tsx'), 'utf8');
    const page = readFileSync(join(here, '../app/panel/musteriler/page.tsx'), 'utf8');
    const helpers = readFileSync(join(here, 'customer-form-helpers.ts'), 'utf8');
    assert.match(form, /subType: 'private_customer'/);
    assert.doesNotMatch(form, /entityType: 'individual'/);
    assert.match(page, /isYeniDosyaOzelMusteriAdd/);
    assert.match(page, /Önce kurumsal veya bireysel seçin/);
    assert.doesNotMatch(page, /Özel müşteri bireysel kişidir/);
    assert.match(page, /ozelMusteriAdd \? OZEL_MUSTERI_SUB_TYPE : ''/);
    assert.match(helpers, /value: 'private_customer', label: 'Özel Müşteri', forType: 'both'/);
    assert.match(page, /\? 'Özel Müşteri'/);
  });
});
