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
  relationshipTypeLabelsForArea,
  relationshipUsageAreaForCustomerSubType,
} from './relationship-type-usage.ts';

const here = dirname(fileURLToPath(import.meta.url));

const catalog = [
  { label: 'Dosya Sorumlusu', active: true, usageAreas: ['eksper'] },
  { label: 'Operasyon Yetkilisi', active: true, usageAreas: ['musteri'] },
];

describe('ilişki türü kullanım alanı LOCK', () => {
  it('eksper kartı eksper işaretini basar; müşteri kartı basmaz', () => {
    assert.equal(relationshipUsageAreaForCustomerSubType('eksper_firmasi'), 'eksper');
    assert.equal(relationshipUsageAreaForCustomerSubType('eksper'), 'eksper');
    assert.equal(relationshipUsageAreaForCustomerSubType('sigorta_sirketi'), 'musteri');
    assert.deepEqual(relationshipTypeLabelsForArea(catalog, 'eksper'), ['Dosya Sorumlusu']);
    assert.deepEqual(relationshipTypeLabelsForArea(catalog, 'musteri'), ['Operasyon Yetkilisi']);
  });

  it('müşteri formu kartın tipine göre listeyi seçer', () => {
    const page = readFileSync(join(here, '../app/panel/musteriler/page.tsx'), 'utf8');
    assert.match(page, /relationshipUsageAreaForCustomerSubType\(form\.subType\)/);
    assert.match(page, /relationshipTypeLabelsForArea/);
    assert.doesNotMatch(page, /\.includes\('musteri'\)/);
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
