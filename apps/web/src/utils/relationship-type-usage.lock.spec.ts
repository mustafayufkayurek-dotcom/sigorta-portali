/**
 * İlişki türü, işaretlenen kartta listelenir.
 * Çalıştır: node --experimental-strip-types --test apps/web/src/utils/relationship-type-usage.lock.spec.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  relationshipTypeAppliesToArea,
  relationshipTypeLabelsForArea,
  relationshipTypeLabelsForVendorCategory,
  relationshipUsageAreaForCustomerSubType,
  relationshipUsageDisplayLabels,
  toggleRelationshipCustomerChild,
  toggleRelationshipUsageParent,
  toggleRelationshipVendorChild,
} from './relationship-type-usage.ts';

const here = dirname(fileURLToPath(import.meta.url));

const catalog = [
  { label: 'Dosya Sorumlusu', active: true, usageAreas: ['eksper'] },
  { label: 'Operasyon Yetkilisi', active: true, usageAreas: ['musteri'] },
  { label: 'Hasar Uzmanı', active: true, usageAreas: ['sigorta_sirketi'] },
];

describe('ilişki türü kullanım alanı LOCK', () => {
  it('eksper kartı eksper işaretini basar; müşteri kartı basmaz', () => {
    assert.equal(relationshipUsageAreaForCustomerSubType('insured'), 'insured');
    assert.equal(relationshipUsageAreaForCustomerSubType('eksper_firmasi'), 'eksper');
    assert.equal(relationshipUsageAreaForCustomerSubType('eksper'), 'eksper');
    assert.equal(relationshipUsageAreaForCustomerSubType('sigorta_sirketi'), 'sigorta_sirketi');
    assert.equal(relationshipUsageAreaForCustomerSubType('broker_firmasi'), 'broker_firmasi');
    assert.equal(relationshipUsageAreaForCustomerSubType('asistan_firmasi'), 'asistan_firmasi');
    assert.equal(relationshipUsageAreaForCustomerSubType('private_customer'), 'private_customer');
    assert.deepEqual(relationshipTypeLabelsForArea(catalog, 'eksper'), ['Dosya Sorumlusu', 'Operasyon Yetkilisi']);
    assert.deepEqual(relationshipTypeLabelsForArea(catalog, 'musteri'), ['Operasyon Yetkilisi']);
    assert.deepEqual(relationshipTypeLabelsForArea(catalog, 'sigorta_sirketi'), ['Operasyon Yetkilisi', 'Hasar Uzmanı']);
    assert.equal(relationshipTypeAppliesToArea(catalog[1]!, 'eksper'), true);
    assert.equal(relationshipTypeAppliesToArea(catalog[0]!, 'sigorta_sirketi'), false);
  });

  it('müşteri formu kartın tipine göre listeyi seçer', () => {
    const page = readFileSync(join(here, '../app/panel/musteriler/page.tsx'), 'utf8');
    assert.match(page, /relationshipUsageAreaForCustomerSubType\(form\.subType\)/);
    assert.match(page, /relationshipTypeLabelsForArea/);
    assert.doesNotMatch(page, /\.includes\('musteri'\)/);
  });

  it('ayar kutusunda eksper müşterinin altıdır; Dosya yok', () => {
    const page = readFileSync(join(here, '../app/panel/ayarlar/iliski-turleri/page.tsx'), 'utf8');
    assert.match(page, /toggleRelationshipUsageParent/);
    assert.match(page, /toggleRelationshipCustomerChild/);
    assert.match(page, /RELATIONSHIP_CUSTOMER_CHILDREN/);
    assert.match(page, /RELATIONSHIP_VENDOR_CHILDREN/);
    assert.match(page, /Sigortalı/);
    assert.match(page, /Broker Firma/);
    assert.match(page, /Asistans Firma/);
    assert.match(page, /Özel Müşteri/);
    assert.match(page, /Acil Yardım/);
    assert.match(page, /Hasar Onarım/);
    assert.doesNotMatch(page, /label: 'Dosya'/);
    assert.doesNotMatch(page, /USAGE_AREAS/);
  });

  it('müşteri altı açılır; yalnız işaretli kartta durur', () => {
    let areas = toggleRelationshipUsageParent([], 'musteri');
    assert.deepEqual(areas, ['musteri']);
    areas = toggleRelationshipCustomerChild(areas, 'eksper');
    assert.deepEqual(areas, ['eksper']);
    assert.deepEqual(relationshipUsageDisplayLabels(areas), ['Müşteri · Eksper']);
    areas = toggleRelationshipCustomerChild(areas, 'sigorta_sirketi');
    assert.ok(areas.includes('eksper'));
    assert.ok(areas.includes('sigorta_sirketi'));
    assert.ok(!areas.includes('musteri'));
    areas = toggleRelationshipCustomerChild(areas, 'broker_firmasi');
    assert.ok(areas.includes('broker_firmasi'));
    assert.deepEqual(relationshipUsageDisplayLabels(areas), ['Müşteri · Eksper', 'Müşteri · Sigorta Şirketi', 'Müşteri · Broker Firma']);
    areas = toggleRelationshipUsageParent(['musteri', 'eksper', 'dosya'], 'musteri');
    assert.deepEqual(areas, []);
    assert.equal(relationshipTypeAppliesToArea({ label: 'Broker Yetkili', usageAreas: ['broker_firmasi'] }, 'broker_firmasi'), true);
    assert.equal(relationshipTypeAppliesToArea({ label: 'Broker Yetkili', usageAreas: ['broker_firmasi'] }, 'musteri'), false);
    assert.equal(relationshipTypeAppliesToArea({ label: 'Broker Yetkili', usageAreas: ['broker_firmasi'] }, 'sigorta_sirketi'), false);
    assert.equal(relationshipTypeAppliesToArea({ label: 'Vekil', usageAreas: ['insured'] }, 'insured'), true);
    assert.equal(relationshipTypeAppliesToArea({ label: 'Vekil', usageAreas: ['insured'] }, 'eksper'), false);
    assert.equal(relationshipTypeAppliesToArea({ label: 'Vekil', usageAreas: ['musteri'] }, 'insured'), true);
    areas = toggleRelationshipCustomerChild(['musteri'], 'insured');
    assert.deepEqual(areas, ['insured']);
    assert.deepEqual(relationshipUsageDisplayLabels(areas), ['Müşteri · Sigortalı']);
  });

  it('tedarikçi altı Acil Yardım ve Hasar Onarım; yalnız o kartta durur', () => {
    let areas = toggleRelationshipUsageParent([], 'tedarikci');
    assert.deepEqual(areas, ['tedarikci']);
    assert.deepEqual(relationshipUsageDisplayLabels(areas), ['Tedarikçi']);
    areas = toggleRelationshipVendorChild(areas, 'acil');
    assert.deepEqual(areas, ['acil']);
    assert.deepEqual(relationshipUsageDisplayLabels(areas), ['Tedarikçi · Acil Yardım']);
    const catalog = [
      { label: 'Saha Sorumlusu', active: true, usageAreas: ['acil'] },
      { label: 'Muhasebeci', active: true, usageAreas: ['tedarikci'] },
      { label: 'Hasar Usta', active: true, usageAreas: ['hasar'] },
    ];
    assert.deepEqual(relationshipTypeLabelsForVendorCategory(catalog, 'acil'), ['Saha Sorumlusu', 'Muhasebeci']);
    assert.deepEqual(relationshipTypeLabelsForVendorCategory(catalog, 'hasar'), ['Muhasebeci', 'Hasar Usta']);
    assert.deepEqual(
      relationshipTypeLabelsForVendorCategory(catalog, 'her_ikisi'),
      ['Saha Sorumlusu', 'Muhasebeci', 'Hasar Usta'],
    );
    assert.equal(relationshipTypeAppliesToArea(catalog[0]!, 'hasar'), false);
    const vendors = readFileSync(join(here, '../app/panel/tedarikciler/page.tsx'), 'utf8');
    assert.match(vendors, /relationshipTypeLabelsForVendorCategory/);
  });

  it('kurumsal Müşteri Bilgileri ve Yetkili adımında Görev durur', () => {
    const page = readFileSync(join(here, '../app/panel/musteriler/page.tsx'), 'utf8');
    const step1 = page.slice(
      page.indexOf('{activeSection === 0 && ('),
      page.indexOf('{activeSection === 1 && ('),
    );
    assert.match(step1, /Yetkili Kişi Adı/);
    assert.match(step1, /label="Görev \/ Ünvan"/);
    assert.match(step1, /Görevini seçin/);
    assert.match(step1, /syncPrimaryContact/);
    const step2 = page.slice(
      page.indexOf('{activeSection === 1 && ('),
      page.indexOf('{activeSection === 2 && ('),
    );
    assert.match(step2, /label="Görev \/ Ünvan"/);
    assert.match(step2, /Görevini seçin/);
  });
});
