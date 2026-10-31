/**
 * Yeni Dosya formu — dosya sorumlusu, özel müşteri, hizmet, irtibat, i yardımı.
 * Çalıştır: node --experimental-strip-types --test apps/web/src/components/claim-files/claim-new-form.lock.spec.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const form = readFileSync(join(here, 'ClaimNewForm.tsx'), 'utf8');
const list = readFileSync(join(here, '../../app/panel/hasar-dosyalari/page.tsx'), 'utf8');
const hint = readFileSync(join(here, '../ui/HintIcon.tsx'), 'utf8');
const fieldHelp = readFileSync(join(here, '../ui/FieldHelpTip.tsx'), 'utf8');

describe('yeni dosya form lock', () => {
  it('başlık Yeni Dosya; dosya sorumlusu, hizmet türü, özel müşteri ve irtibat durur', () => {
    assert.match(list, /title="Yeni Dosya"/);
    assert.match(form, /Dosya Sorumlusu/);
    assert.match(form, /assignedOfficeUserId/);
    assert.match(form, /Özel Müşteri/);
    assert.match(form, /Hizmet Türü/);
    assert.match(form, /İrtibat Ad Soyad/);
    assert.match(form, /İrtibat Telefon/);
    assert.match(form, /İhbar Detayı/);
    {
      const openAddr = form.indexOf('data-field="openAddress"');
      const ihbar = form.indexOf('İhbar Detayı');
      const irtibat = form.indexOf('İrtibat Ad Soyad');
      assert.ok(openAddr > 0 && ihbar > openAddr, 'Açık Adres İhbar Detayı’nın üstündedir');
      assert.ok(irtibat > 0 && irtibat < openAddr, 'İrtibat Açık Adres’in üstündedir');
      assert.equal(form.slice(openAddr, ihbar).includes('İrtibat'), false);
    }
    assert.match(form, /toTitleCaseTR\(description\.trim\(\)\)/);
    assert.match(form, /if \(v\) setDescription\(v\)/);
    const editModal = readFileSync(
      join(here, '../../app/panel/hasar-dosyalari/[id]/_components/DosyaBilgileriEditModal.tsx'),
      'utf8',
    );
    assert.match(editModal, /İhbar İçeriği/);
    {
      const openAddr = editModal.indexOf('ADDRESS_FIELD.openAddress');
      const ihbar = editModal.indexOf('İhbar İçeriği');
      assert.ok(openAddr > 0 && ihbar > openAddr, 'Düzenle’de Açık Adres İhbar İçeriği’nin üstündedir');
    }
    assert.match(editModal, /toTitleCaseTR\(description\.trim\(\)\)/);
    const acilForm = readFileSync(join(here, '../emergency/EmergencyCaseNewForm.tsx'), 'utf8');
    {
      const addr = acilForm.indexOf('ADDRESS_FIELD.openAddress');
      const findings = acilForm.indexOf('id="tespit-bulgulari"');
      assert.ok(addr > 0 && findings > addr, 'Acil Yeni Dosya’da Açık Adres Tespit Bulguları’nın üstündedir');
    }
    assert.match(acilForm, /toTitleCaseTR\(notes\.trim\(\)\)/);
    assert.match(acilForm, /toTitleCaseTR\(findingsText\.trim\(\)\)/);
    assert.match(form, /rapora yazılmaz/);
    assert.match(form, /FieldHelpTip/);
    assert.match(form, /dosya-no-yardim/);
    assert.match(form, /irtibat-telefon-yardim/);
    assert.doesNotMatch(form, /Bitişik yazabilirsiniz; boşluklar eşleştirmede dikkate alınmaz\.<\/p>/);
    assert.doesNotMatch(form, /Yalnız tespit içindir; rapora yazılmaz\.<\/p>/);
    const acil = readFileSync(join(here, '../emergency/EmergencyCaseNewForm.tsx'), 'utf8');
    assert.match(acil, /acil-dosya-no-yardim/);
    assert.match(acil, /acil-tespit-bulgulari-yardim/);
    assert.doesNotMatch(acil, /Bitişik yazabilirsiniz; boşluklar eşleştirmede dikkate alınmaz\.<\/p>/);
    assert.match(form, /data-field="assignedOfficeUserId"/);
    assert.match(form, /data-field="fileNo"/);
    const detay = readFileSync(
      join(here, '../../app/panel/hasar-dosyalari/[id]/_components/DosyaBilgileriDetay.tsx'),
      'utf8',
    );
    assert.match(detay, /İrtibat Ad Soyad/);
    {
      const addr = detay.indexOf("label: 'Hasar Adresi'");
      const ihbar = detay.indexOf("label: 'İhbar İçeriği'");
      assert.ok(addr > 0 && ihbar > addr, 'Detay’da Hasar Adresi İhbar İçeriği’nin üstündedir');
    }
    assert.match(detay, /hasarIrtibatAdi/);
    assert.match(form, /filterInsuranceCatalogForHasarFileForm/);
    assert.doesNotMatch(form, /isOfficeStaffRole\(roleCode\) && scopedIds/);
    assert.doesNotMatch(form, /Bitişik yazabilirsiniz; boşluklar eşleştirmede dikkate alınmaz\.<\/p>/);
    assert.match(form, /CLAIM_SERVICE_KINDS\.map/);
    assert.match(form, /<option key=\{kind\} value=\{kind\}>/);
    assert.match(form, /data-field="lossType"/);
    assert.doesNotMatch(form, /prefs\.lossType/);
    assert.doesNotMatch(form, /saveClaimNewPrefs/);
    assert.doesNotMatch(form, /loadClaimNewPrefs/);
    const addressFields = readFileSync(join(here, '../../constants/address-fields.ts'), 'utf8');
    assert.match(addressFields, /provincePlaceholder: 'Seçiniz\.\.\.'/);
    assert.match(addressFields, /districtPlaceholder: 'Seçiniz\.\.\.'/);
    assert.doesNotMatch(form, /data-field="serviceKind"[\s\S]{0,800}type="button"/);
    assert.doesNotMatch(form, /spanFull.*data-field="serviceKind"/);
    assert.match(form, /newClaimOpeningCaption\(serviceKind\)/);
    assert.doesNotMatch(form, /Hasar Dosyası Açılıyor/);
    assert.match(form, /claimServiceKindFromListHizmet\(listHizmet\)/);
    assert.match(form, /Danışmanlık Hizmet Türü/);
    assert.match(form, /consultancyServiceTypeId/);
    assert.match(form, /params: \{ family: CONSULTANCY_SERVICE_FAMILY \}/);
    assert.match(form, /consultancyTypesForNewFile/);
    assert.match(form, /required/);
    assert.match(form, /data-field="consultancyServiceTypeId"/);
    assert.match(form, /Yeni Özel Müşteri/);
    assert.match(form, /\/panel\/musteriler/);
    assert.match(form, /subType: 'private_customer'/);
    assert.doesNotMatch(form, /entityType: 'individual'/);
    assert.match(form, /prefillCustomerId/);
    assert.doesNotMatch(form, /CLAIM_FILE_SERVICE_KIND_TOP/);
    assert.doesNotMatch(form, /Danışmanlık Hizmeti/);
    assert.doesNotMatch(form, /danismanlik-hizmet-ilk-kullanim-seridi/);
    assert.match(form, /Dosya Kanalı/);
    assert.match(form, /data-field="channelAgencyCustomerId"/);
    assert.match(form, /data-field="channelBrokerCustomerId"/);
    assert.match(form, /data-field="channelExpertCustomerId"/);
    assert.match(form, /dosya-kanali-yardim/);
    assert.match(form, /Dosyayı biz açarız/);
    assert.doesNotMatch(form, /Dosyayı biz açarız\. Rapor ve yazışma burada seçilen taraflara gider\.<\/p>/);
  });

  it('sayfa başlığı i yasağı durur; alan yardımı ayrıdır', () => {
    assert.match(hint, /return null/);
    assert.match(fieldHelp, /export function FieldHelpTip/);
    assert.match(fieldHelp, /export function FieldLabel/);
    assert.match(fieldHelp, /onClick/);
  });
});
