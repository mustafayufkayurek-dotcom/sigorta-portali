import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import {
  DEFAULT_MASRAF_KDV_ORANLARI,
  expenseDocumentModeFromFlag,
  hasTaxDocumentFromMode,
  normalizeMasrafKdvOranlari,
  parseMasrafDocumentFields,
  resolveExpenseVatFate,
  splitGrossVat,
  sumSplitGrossVatLines,
} from './expense-vat.ts';

describe('masraf KDV LOCK', () => {
  it('KDV dahil tutardan matrah ve KDV ayırır', () => {
    const r = splitGrossVat(1200, 20);
    assert.equal(r.matrah, 1000);
    assert.equal(r.vatAmount, 200);
    assert.equal(r.genelToplam, 1200);
  });

  it('çoklu KDV satırını toplar', () => {
    const s = sumSplitGrossVatLines([
      { amount: 1200, vatRate: 20 },
      { amount: 110, vatRate: 10 },
    ]);
    assert.equal(s.lineCount, 2);
    assert.equal(s.matrah, 1100);
    assert.equal(s.vatAmount, 210);
    assert.equal(s.genelToplam, 1310);
  });

  it('KDV dahil 109 (%1) + 130 (%0) fiş toplamı 239 eder; matrah yazılırsa 237,92 olur', () => {
    const dogru = sumSplitGrossVatLines([
      { amount: 109, vatRate: 1 },
      { amount: 130, vatRate: 0 },
    ]);
    assert.equal(dogru.genelToplam, 239);
    assert.equal(splitGrossVat(109, 1).matrah, 107.92);

    const matrahYazilmissa = sumSplitGrossVatLines([
      { amount: 107.92, vatRate: 1 },
      { amount: 130, vatRate: 0 },
    ]);
    assert.equal(matrahYazilmissa.genelToplam, 237.92);
  });

  it('KDV dahil 350 (%20) matrah 291,67 ve KDV 58,33 eder; tutar değişmez', () => {
    const r = splitGrossVat(350, 20);
    assert.equal(r.matrah, 291.67);
    assert.equal(r.vatAmount, 58.33);
    assert.equal(r.genelToplam, 350);
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

  it('eski açıklamadaki belge türü ve no ayrılır; yeni kayıt ayrı sütundadır', () => {
    const parsed = parseMasrafDocumentFields({
      description: 'Kasa Fişi - Belge No: 91 - Muhtelif yiyecek',
    });
    assert.equal(parsed.documentType, 'Kasa Fişi');
    assert.equal(parsed.documentNo, '91');
    assert.match(parsed.description, /Muhtelif/i);

    const stored = parseMasrafDocumentFields({
      description: 'Çatı kaplama',
      receiptDocumentType: 'Fatura',
      receiptDocumentNo: '102',
    });
    assert.equal(stored.documentType, 'Fatura');
    assert.equal(stored.documentNo, '102');
    assert.equal(stored.description, 'Çatı kaplama');
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
    assert.match(masraf, /masraf-yolu-\$\{opt\.id\}/);
    assert.match(masraf, /EXPENSE_LANE_SELECT_GROUPS/);
    assert.match(masraf, /optgroup/);
    assert.match(masraf, /finans-masraf-yolu/);
    assert.match(masraf, /value=\{opt\.id\}/);
    assert.match(masraf, /Hasar Tespit|tespit/);
    assert.match(masraf, /Poliçe Yönetimi|police/);
    assert.match(masraf, /masraf-form-footer/);
    assert.match(masraf, /grid-rows-\[auto_minmax\(0,1fr\)_auto\]/);
    assert.match(masraf, /safe-area-inset-bottom/);
    assert.match(masraf, /pb-\[max\(2rem/);
    assert.match(masraf, /bg-slate-50/);
    assert.match(masraf, /sumSplitGrossVatLines/);
    assert.match(masraf, /hasTaxDocument/);
    assert.match(masraf, /masraf-kdv-ozet/);
    assert.match(masraf, /masraf-kalem-satir-ekle/);
    assert.match(masraf, /masraf-akilli-fis/);
    assert.match(masraf, /scrollContent=\{false\}/);
    assert.match(masraf, /overscroll-contain/);
    assert.match(masraf, /Tutar — KDV Dahil/);
    assert.doesNotMatch(masraf, /Rapordaki iş grubunu seçin/);
    assert.match(masraf, /FieldLabel/);
    assert.match(masraf, /masraf-kdv-raporu-link/);
    assert.match(masraf, /masraf-cari-sayfa/);
    assert.match(masraf, /masraf-secili-dosya-link/);
    assert.match(masraf, /masraf-kdv-oran-ekle/);
    assert.match(masraf, /masraf-kdv-oranlari/);
    assert.match(masraf, /TrAmountCalcField/);
    assert.match(masraf, /masraf-tutar-hesap-/);
    assert.match(masraf, /data-testid=\{idx === 0 \? 'masraf-kdv-oran'/);
    assert.match(masraf, /<select[\s\S]{0,400}masraf-kdv-oran/);
    assert.match(masraf, /masraf-kalem-kdv-tutar-/);
    assert.match(masraf, /Hesaplanan KDV/);
    assert.doesNotMatch(masraf, /MasrafKdvOranInput/);
    assert.match(masraf, /handleGroupPick|handleSubgroupPick/);
    assert.match(masraf, /masraf-son-kayit-seridi|Kaydedildi:/);
    // SlidePanel z-210 flu örtü altında kalmasın — FinansModal portal z-400
    assert.match(masraf, /FinansModal/);
    assert.match(masraf, /masraf-kategori-draft-modal/);
    assert.doesNotMatch(masraf, /SettingsModal/);
    assert.match(masraf, /masraf-kategori-draft-kdv/);
    assert.match(masraf, /Masraf KDV Oranları/);
    assert.match(masraf, /normalizeFormFreeText/);
    assert.match(masraf, /minmax\(0,1\.55fr\)/);
    assert.match(masraf, /masraf-kdv-oran-ekle-ac/);
    // Kaydet ve Yeni = sıfır form; yol/dosya/cari önceki fişten kalmaz
    assert.match(masraf, /mode === 'new'/);
    assert.doesNotMatch(
      masraf,
      /mode === 'new'[\s\S]{0,800}expenseLane:\s*form\.expenseLane/,
      'Kaydet ve Yeni Masraf Yolu’nu eski fişten taşımaz',
    );
    assert.doesNotMatch(
      masraf,
      /mode === 'new'[\s\S]{0,800}partyAccountId:\s*form\.partyAccountId/,
      'Kaydet ve Yeni cariyi eski fişten taşımaz',
    );
    assert.doesNotMatch(
      masraf,
      /mode === 'new'[\s\S]{0,900}fileCaseId:\s*fileLane \? form\.fileCaseId/,
      'Kaydet ve Yeni dosyayı eski fişten taşımaz',
    );
    assert.ok(
      masraf.indexOf('KDV Oranı') < masraf.indexOf('masraf-kdv-oran-ekle-ac'),
      '+ Oran etiket satırında durur',
    );
    assert.match(masraf, /readOnly/);
    assert.ok(
      masraf.indexOf('Hesaplanan KDV') < masraf.indexOf('masraf-kalem-kdv-tutar-'),
      'Hesaplanan KDV oran yanında kutuda durur',
    );
    assert.doesNotMatch(masraf, /Hesaplanan KDV:\s*\{/);
    assert.doesNotMatch(masraf, /masraf-kalem-matrah-/);
    assert.doesNotMatch(masraf, /Fiş Toplamı \(KDV Dahil\)/);
    assert.match(masraf, /receiptDocumentType/);
    assert.match(masraf, /Belge Türü/);
    assert.match(masraf, /birden fazla masraf grubuna bağlanamaz/);
    assert.doesNotMatch(masraf, /composeMasrafDescription/);
    assert.doesNotMatch(masraf, /masraf-kdv-yazi/);
    assert.doesNotMatch(masraf, /TrAmountCalculator/);
    assert.ok(
      masraf.indexOf('masraf-akilli-fis') < masraf.indexOf('masraf-yolu-select'),
      'Akıllı fiş Masraf Yolu’ndan önce durur',
    );
    assert.ok(
      masraf.indexOf('masraf-yolu-select') < masraf.indexOf('masraf-dosya-select'),
      'İlgili Dosya / Sigortalı Masraf Yolu’ndan hemen sonra durur',
    );
    assert.ok(
      masraf.indexOf('masraf-dosya-select') < masraf.indexOf('masraf-cari-kaynak'),
      'Dosya seçimi Ödeme Kaynağı’ndan önce durur',
    );
    assert.ok(
      masraf.indexOf('masraf-yolu-select') < masraf.indexOf('masraf-kdv-ozet'),
      'Masraf Yolu tutar/KDV özetinden önce durur',
    );
    assert.ok(
      masraf.indexOf('masraf-kdv-ozet') < masraf.indexOf('masraf-form-footer'),
      'Alt Kaydet tuşları formun altında sabit durur',
    );
    assert.match(masraf, /sigortalı adı soyadı/);
    assert.ok(
      /className="[^"]*items-center[^"]*"\s*\n\s*data-testid="masraf-form-footer"/.test(masraf),
      'Alt bant tuşları dikey ortalı',
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
    assert.match(vatSvc, /receiptDocumentNo/);
  });
});
