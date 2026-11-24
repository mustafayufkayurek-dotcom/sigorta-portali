/**
 * Kilit: Tedarikçi türü listesi boş kalmaz; Acil kayıtta da açılır.
 * Çalıştır: node --experimental-strip-types --test apps/web/src/utils/vendor-form-helpers.lock.spec.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { DEFAULT_VENDOR_TYPES, resolveVendorTypeList } from './vendor-type-list.ts';

const here = dirname(fileURLToPath(import.meta.url));

describe('tedarikçi türü listesi LOCK', () => {
  it('ofis / sabit hizmet ve vade kuralları kaynakta durur', () => {
    const formHelper = readFileSync(join(here, 'vendor-form-helpers.ts'), 'utf8');
    assert.match(formHelper, /export function isVendorOfisCategory/);
    assert.match(formHelper, /export function vendorCategoryRequiresPaymentDue/);
    assert.match(formHelper, /export function vendorCategoryRequiresServiceAreas/);
    assert.match(formHelper, /OFIS_VENDOR_TYPE_QUICK_PICKS/);
    assert.match(formHelper, /'Doğalgaz'/);
    assert.match(formHelper, /'İnternet'/);
    assert.match(formHelper, /category === 'ofis'|=== 'ofis'/);
    // Ofiste vade false; operasyonda true (negasyon)
    assert.match(formHelper, /vendorCategoryRequiresPaymentDue[\s\S]{0,120}!isVendorOfisCategory/);
    assert.match(formHelper, /vendorCategoryRequiresServiceAreas[\s\S]{0,120}!isVendorOfisCategory/);
  });

  it('API boş veya hatalıysa Taşeron / Malzeme / Lojistik / Ekipman / Diğer durur', () => {
    assert.deepEqual(resolveVendorTypeList(undefined), [...DEFAULT_VENDOR_TYPES]);
    assert.deepEqual(resolveVendorTypeList([]), [...DEFAULT_VENDOR_TYPES]);
    assert.deepEqual(resolveVendorTypeList(['', '  ']), [...DEFAULT_VENDOR_TYPES]);
  });

  it('kayıtlı türler korunur; boşluk ve tekrar düşer', () => {
    assert.deepEqual(resolveVendorTypeList([' Taşeron ', 'Taşeron', 'Nakliye']), ['Taşeron', 'Nakliye']);
  });

  it('form native select yerine açılır liste kullanır; yetkisiz yüklemede varsayılan kalır', () => {
    const page = readFileSync(join(here, '../app/panel/tedarikciler/page.tsx'), 'utf8');
    assert.match(page, /vendorIdentityCardLine/);
    assert.match(page, /Şahıs/);
    assert.match(page, /Şirket/);
    assert.match(page, /tedarikci-tip-\$\{val\}/);
    assert.match(page, /TC Kimlik No/);
    assert.match(page, /form\.identityNo && !isValidTcKimlikNo/);
    assert.doesNotMatch(page, /Kayıt için TC kimlik doğrulaması gerekir/);
    const formHelper = readFileSync(join(here, 'vendor-form-helpers.ts'), 'utf8');
    assert.match(formHelper, /vendorIdentityCardLine/);
    assert.match(formHelper, /TC Kimlik No/);
    assert.match(formHelper, /Vergi No/);
    assert.match(formHelper, /vendorIdentityGapLabel/);
    assert.match(formHelper, /Vergi No Eksik/);
    assert.doesNotMatch(formHelper, /TC No Eksik/);
    assert.doesNotMatch(formHelper, /No eksik/);
    assert.match(page, /vendorIdentityGapLabel/);
    assert.doesNotMatch(page, /TC kimlik veya vergi levhası yükleyin/);
    assert.doesNotMatch(page, /pendingDocs\.length === 0/);
    assert.match(page, /tedarikci-satir-kimlik-eksik/);
    assert.doesNotMatch(page, /tedarikci-kimlik-eksik-filtre/);
    assert.doesNotMatch(page, /tedarikci-kimlik-eksik-banner/);
    assert.doesNotMatch(page, /identityMissing/);
    assert.match(page, /Kimliği Tamamla/);
    const typeList = readFileSync(join(here, 'vendor-type-list.ts'), 'utf8');
    assert.match(typeList, /DEFAULT_VENDOR_TYPES/);
    assert.match(page, /data-testid="tedarikci-turu-sec"/);
    assert.match(page, /resolveVendorTypeList/);
    assert.match(page, /DEFAULT_VENDOR_TYPES/);
    const typeBlockStart = page.indexOf('data-testid="tedarikci-turu-sec"');
    const typeBlock = page.slice(typeBlockStart, typeBlockStart + 700);
    assert.match(typeBlock, /SearchableSelect/);
    assert.doesNotMatch(typeBlock, /<select/);
  });

  it('görsel düzen: araç çubuğu, adım, sabit alt tuş; operasyonda vade zorunlu, ofis ayrı', () => {
    const page = readFileSync(join(here, '../app/panel/tedarikciler/page.tsx'), 'utf8');
    const formHelper = readFileSync(join(here, 'vendor-form-helpers.ts'), 'utf8');
    assert.match(page, /data-testid="tedarikci-arac-cubugu"/);
    assert.match(page, /data-testid="tedarikci-form-footer"/);
    assert.match(page, /data-testid="tedarikci-vade-yardim"/);
    assert.match(page, /data-testid="tedarikci-vade-secim"/);
    assert.match(page, /data-testid="tedarikci-vade-ofis"/);
    assert.match(page, /data-testid="tedarikci-is-alani"/);
    assert.match(page, /testId="tedarikci-is-ofis"/);
    assert.match(page, /testId="tedarikci-is-operasyon"/);
    assert.match(page, /OFIS_VENDOR_TYPE_QUICK_PICKS/);
    assert.match(page, /data-testid="tedarikci-ofis-turu"/);
    const ofisTurBlock = page.slice(page.indexOf('data-testid="tedarikci-ofis-turu"'), page.indexOf('data-testid="tedarikci-ofis-turu"') + 900);
    assert.match(ofisTurBlock, /SearchableSelect/);
    assert.doesNotMatch(ofisTurBlock, /CompactChoiceButton/);
    assert.match(page, /Hizmet Türü Seçin/);
    assert.match(page, /Seçim zorunludur/);
    assert.match(page, /Hakediş ödeme vadesi zorunludur/);
    assert.match(page, /vendorCategoryRequiresPaymentDue/);
    assert.match(page, /vendorCategoryRequiresServiceAreas/);
    assert.match(formHelper, /vendorCategoryRequiresPaymentDue/);
    assert.match(formHelper, /isVendorOfisCategory/);
    assert.match(formHelper, /OFIS_VENDOR_TYPE_QUICK_PICKS/);
    assert.match(formHelper, /'ofis'/);
    assert.match(page, /data-testid="tedarikci-is-yeri-adresi"/);
    assert.match(page, /İş Yeri Adresi/);
    assert.match(page, /Hizmet Bölgeleri/);
    assert.match(page, /vendorCategoryRequiresServiceAreas\(form\.category\) && serviceAreas\.length === 0/);
    assert.doesNotMatch(page, /pendingDocs\.length === 0/);
    assert.match(page, /data-testid="tedarikci-nvi-dogum"/);
    assert.match(page, /data-testid="tedarikci-kurumsal-ikincil"/);
    assert.match(page, />\s*Geri\s*</);
    assert.match(page, />\s*Devam\s*</);
    assert.match(page, /scrollContent=\{false\}/);
    assert.match(page, /data-testid="tedarikci-hizmet-bolgeleri"/);
    // Liste dışa aktarma / para birimi eklenmez
    assert.doesNotMatch(page, /\bcurrency\b/);
    assert.doesNotMatch(page, /dışa aktar/i);
    assert.doesNotMatch(page, /CSV|Excel.*indir|exportVendors/i);
  });

  it('ikinci görsel tur: sıkı başlık, giriş sırası, cari yardım, sticky işlem', () => {
    const page = readFileSync(join(here, '../app/panel/tedarikciler/page.tsx'), 'utf8');
    const formHelper = readFileSync(join(here, 'vendor-form-helpers.ts'), 'utf8');
    const tablePicker = readFileSync(join(here, '../components/ui/TableColumnPicker.tsx'), 'utf8');
    assert.match(page, /\* işaretli alanlar zorunludur/);
    assert.doesNotMatch(page, /Tüm Bilgileri Eksiksiz Doldurun/);
    assert.match(page, /data-testid="tedarikci-hizmet-grubu"/);
    assert.match(page, /data-testid="tedarikci-cari-rol-yardim"/);
    assert.match(page, /vendorCariRolHelpText/);
    assert.match(page, /handleContinue/);
    assert.match(page, /focusFirstInvalidField/);
    assert.match(page, /data-testid="tedarikci-form-kaydet-grup"/);
    assert.match(page, /data-testid="tedarikci-form-footer-actions"/);
    assert.match(page, /grid w-full grid-cols-2/);
    const slidePanel = readFileSync(join(here, '../components/SlidePanel.tsx'), 'utf8');
    assert.match(slidePanel, /!mt-0/);
    assert.match(slidePanel, /inset-y-0/);
    assert.doesNotMatch(page, /hidden gap-1\.5 sm:flex[\s\S]{0,180}Adım \$\{i/);
    assert.match(formHelper, /vendorCariRolHelpText/);
    assert.match(formHelper, /T\.C\. kimlik numarası opsiyoneldir/);
    assert.match(formHelper, /Çift rolde T\.C\. kimlik numarası zorunludur/);
    assert.match(tablePicker, /PANEL_TABLE_PIN_END_TD_CLASS/);
    assert.match(tablePicker, /sticky right-0/);
    // Tip+cari → kimlik → iletişim → hizmet (tür/kategori birleşik) sırası
    const tipIdx = page.indexOf('data-testid="tedarikci-tip-cari-satir"');
    const cariIdx = page.indexOf('data-testid="tedarikci-cari-rol"');
    const kurumsalIdx = page.indexOf('title="Kurumsal Bilgiler"');
    const iletisimIdx = page.indexOf('title="İletişim Bilgileri"');
    const hizmetIdx = page.indexOf('data-testid="tedarikci-hizmet-grubu"');
    const turIdx = page.indexOf('data-testid="tedarikci-turu-sec"');
    assert.ok(tipIdx > 0 && cariIdx > tipIdx);
    assert.ok(kurumsalIdx > cariIdx && iletisimIdx > kurumsalIdx);
    assert.ok(hizmetIdx > iletisimIdx && turIdx > hizmetIdx);
  });

  it('Temel Bilgiler yoğunluk: h-9 giriş, kompakt seçim, 2 sütun grid', () => {
    const page = readFileSync(join(here, '../app/panel/tedarikciler/page.tsx'), 'utf8');
    const phone = readFileSync(join(here, '../components/ContactPhoneField.tsx'), 'utf8');
    const formHelper = readFileSync(join(here, 'vendor-form-helpers.ts'), 'utf8');
    assert.match(page, /function CompactChoiceButton/);
    assert.match(page, /bg-brand-50 text-brand-800/);
    assert.match(page, /data-testid="tedarikci-tip-secim"/);
    assert.match(page, /data-testid="tedarikci-tip-cari-satir"/);
    assert.match(page, /data-testid="tedarikci-hizmet-kategori"/);
    assert.match(page, /const inp = '[^']*h-9/);
    assert.match(page, /grid grid-cols-1 gap-3 min-\[420px\]:grid-cols-2/);
    assert.match(page, /data-testid="tedarikci-temel-bilgiler"/);
    assert.match(page, /Tedarikçi Tipi/);
    assert.match(page, /Cari Rol/);
    assert.match(page, /col-span-full[\s\S]{0,80}tedarikci-cari-rol-yardim/);
    assert.match(page, /tedarikci-form-telefon[\s\S]{0,200}ContactPhoneField/);
    assert.match(page, /VENDOR_FORM_SECTIONS/);
    assert.match(formHelper, /'İlişki ve Finans'/);
    assert.doesNotMatch(formHelper, /İlişki Özeti & Finans/);
    assert.match(phone, /compact\?: boolean/);
    assert.match(phone, /flex-nowrap/);
    assert.doesNotMatch(phone, /basis-\[min\(100%,8rem\)\]/);
    // Eski kart tipi (büyük py-3 + brand-600 dolu zemin) Temel Bilgiler seçiminde yok
    assert.doesNotMatch(page, /tedarikci-tip-secim[\s\S]{0,800}bg-brand-600 text-white/);
    assert.doesNotMatch(page, /tedarikci-hizmet-kategori[\s\S]{0,600}bg-brand-600 text-white/);
    // Devam sağ uçta; İptal order-last değil
    assert.doesNotMatch(page, /tedarikci-form-footer-actions[\s\S]{0,400}sm:order-last/);
  });
});
