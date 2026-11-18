import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import {
  DEFAULT_MASRAF_KDV_ORANLARI,
  expenseDocumentModeFromFlag,
  hasTaxDocumentFromMode,
  normalizeMasrafKdvOranlari,
  resolveExpenseVatFate,
  splitGrossVat,
} from './expense-vat.ts';

describe('masraf KDV LOCK', () => {
  it('KDV dahil tutardan matrah ve KDV ayırır', () => {
    const r = splitGrossVat(1200, 20);
    assert.equal(r.matrah, 1000);
    assert.equal(r.vatAmount, 200);
    assert.equal(r.genelToplam, 1200);
  });

  it('oran listesi boşsa varsayılanı koyar', () => {
    assert.deepEqual(normalizeMasrafKdvOranlari(null), [...DEFAULT_MASRAF_KDV_ORANLARI]);
    assert.deepEqual(normalizeMasrafKdvOranlari([20, 1, 10, 20]), [1, 10, 20]);
  });

  it('belgesiz kayıp, harici belgeli telafi, diğer belgeli indirilecek', () => {
    assert.equal(resolveExpenseVatFate({ hasTaxDocument: false }), 'lost');
    assert.equal(
      resolveExpenseVatFate({ hasTaxDocument: true, operationSubject: 'HARICI_MASRAF' }),
      'recovery',
    );
    assert.equal(
      resolveExpenseVatFate({ hasTaxDocument: false, operationSubject: 'HARICI_MASRAF' }),
      'lost',
    );
    assert.equal(resolveExpenseVatFate({ hasTaxDocument: true }), 'deductible');
    assert.equal(expenseDocumentModeFromFlag(false), 'belgesiz');
    assert.equal(hasTaxDocumentFromMode('belgesiz'), false);
  });

  it('masraf formu belge/KDV/Harici ve Ayarlar oran yönetimi durur', () => {
    const root = join(import.meta.dirname, '../../..');
    const masraf = readFileSync(
      join(root, 'apps/web/src/app/panel/finans/masraflar/page.tsx'),
      'utf8',
    );
    assert.match(masraf, /documentMode/);
    assert.match(masraf, /belgeli/);
    assert.match(masraf, /belgesiz/);
    assert.match(masraf, /value="harici"/);
    assert.match(masraf, /splitGrossVat/);
    assert.match(masraf, /hasTaxDocument/);
    assert.match(masraf, /masraf-kdv-ozet/);
    assert.match(masraf, /masraf-akilli-fis/);
    assert.match(masraf, /scrollContent=\{false\}/);
    assert.match(masraf, /Tutar — KDV Dahil/);
    assert.match(masraf, /FieldLabel/);
    assert.match(masraf, /masraf-kdv-raporu-link/);
    assert.match(masraf, /masraf-cari-sayfa/);
    assert.match(masraf, /masraf-secili-dosya-link/);
    assert.match(masraf, /masraf-kdv-oran-ekle/);
    assert.match(masraf, /masraf-kdv-oranlari/);
    assert.doesNotMatch(masraf, /masraf-kdv-yazi/);
    assert.ok(
      masraf.indexOf('masraf-akilli-fis') < masraf.indexOf('masraf-yolu-select'),
      'Akıllı fiş Masraf Yolu’ndan önce durur',
    );
    assert.ok(
      masraf.indexOf('masraf-yolu-select') < masraf.indexOf('masraf-kdv-ozet'),
      'Masraf Yolu tutar/KDV özetinden önce durur',
    );

    const ayar = readFileSync(
      join(root, 'apps/web/src/app/panel/ayarlar/masraf-kategorileri/page.tsx'),
      'utf8',
    );
    assert.match(ayar, /masraf-kdv-oranlari-ayar/);
    assert.match(ayar, /masraf-kdv-oranlari/);

    const kdv = readFileSync(
      join(root, 'apps/web/src/app/panel/finans/kdv-raporu/page.tsx'),
      'utf8',
    );
    assert.match(kdv, /lostVatSection/);
    assert.match(kdv, /kdv-kayip-bolum/);
    assert.match(kdv, /Harici Telafi/);

    const vatSvc = readFileSync(
      join(root, 'apps/backend/src/modules/finance/vat-report.service.ts'),
      'utf8',
    );
    assert.match(vatSvc, /lostVatSection/);
    assert.match(vatSvc, /getMasrafKdvOranlari/);
  });
});
