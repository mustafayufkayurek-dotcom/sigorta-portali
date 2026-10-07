/**
 * Rapor kategorisi Ayarlar → Mahal sayfasından eklenir; MM kısaltması durur.
 * Çalıştır: node --experimental-strip-types --test packages/shared/src/repair-damage-category.lock.spec.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  mahalSuggestionsForCategory,
  mergeRepairDamageCategories,
  repairDamageCategoryDisplay,
  repairDamageCategorySelectLabel,
  repairDamageCategorySettingsLabel,
} from './repair-damage-category.ts';

const here = dirname(fileURLToPath(import.meta.url));

describe('rapor kategori kataloğu kilidi', () => {
  it('MM kısaltması seçimde MM durur; Bina adı kalır', () => {
    assert.equal(repairDamageCategorySelectLabel({ code: 'mm', name: 'Mali Mesuliyet' }), 'MM');
    assert.equal(repairDamageCategorySelectLabel({ code: 'bina', name: 'Bina' }), 'Bina');
    assert.equal(repairDamageCategorySelectLabel({ code: 'esya', name: 'Eşya' }), 'Eşya');
    assert.equal(repairDamageCategoryDisplay('mm', []), 'MM');
    assert.equal(repairDamageCategorySettingsLabel({ code: 'mm', name: 'Mali Mesuliyet' }), 'Mali Mesuliyet');
  });

  it('liste boşsa Bina, Eşya ve MM durur', () => {
    const merged = mergeRepairDamageCategories([]);
    assert.deepEqual(merged.map((c) => c.code), ['bina', 'esya', 'mm']);
  });

  it('mahal kategoriye bağlıdır; raporda o kategorinin mahalleri gelir', () => {
    const mahaller = readFileSync(
      join(here, '../../../apps/web/src/app/panel/ayarlar/mahaller/page.tsx'),
      'utf8',
    );
    assert.match(mahaller, /Tanımla/);
    assert.match(mahaller, /Tümü/);
    assert.match(mahaller, /Mahal\/Bölge/);
    assert.match(mahaller, /data-kategori-balon/);
    assert.match(mahaller, /\+ Yeni/);
    assert.match(mahaller, /yeni-kategori-ad/);
    assert.match(mahaller, /data-mahal-satir/);
    assert.match(mahaller, /repairDamageCategorySettingsLabel/);
    assert.doesNotMatch(mahaller, /repairDamageCategorySelectLabel/);
    assert.doesNotMatch(mahaller, /kategori-kod/);
    assert.match(mahaller, /claim-locations\/bind/);
    const bindMahalAt = mahaller.indexOf('name="mahal-bolge"');
    const bindCatAt = mahaller.indexOf('data-kategori-balon');
    assert.ok(bindMahalAt > 0 && bindCatAt > bindMahalAt);
    const rapor = readFileSync(
      join(here, '../../../apps/web/src/app/panel/hasar-dosyalari/[id]/onarim-raporu/[reportId]/page.tsx'),
      'utf8',
    );
    assert.match(rapor, /claim-locations\/catalog/);
    assert.match(rapor, /mahalSuggestionsForCategory/);
    assert.match(rapor, /function WorkDefinitionSelector/);
    assert.match(rapor, /\+ Yeni İş Kalemi Ekle/);
    assert.match(rapor, /\+ Yeni İş Grubu Ekle/);
    assert.match(rapor, /function LocationInput/);
    assert.match(rapor, /addLocationIfNew/);
    assert.doesNotMatch(rapor, /<option value="bina">Bina<\/option>/);
    const catalog = [
      { categoryCode: 'bina', label: 'Salon - Zemin' },
      { categoryCode: 'mm', label: 'Yan Daire - Tavan' },
    ];
    assert.deepEqual(mahalSuggestionsForCategory(catalog, 'mm'), ['Yan Daire - Tavan']);
    assert.deepEqual(mahalSuggestionsForCategory(catalog, 'bina'), ['Salon - Zemin']);
  });
});
