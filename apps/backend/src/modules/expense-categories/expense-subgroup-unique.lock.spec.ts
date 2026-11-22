/**
 * Alt grup adı tek üst gruba aittir — başka gruba yazılmaz.
 * Çalıştır: node --experimental-strip-types --test apps/backend/src/modules/expense-categories/expense-subgroup-unique.lock.spec.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const service = readFileSync(join(here, 'expense-categories.service.ts'), 'utf8');
const ctrl = readFileSync(join(here, 'expense-categories.controller.ts'), 'utf8');
const ayar = readFileSync(
  join(here, '../../../../web/src/app/panel/ayarlar/masraf-kategorileri/page.tsx'),
  'utf8',
);
const calc = readFileSync(
  join(here, '../../../../web/src/components/ui/TrAmountCalcField.tsx'),
  'utf8',
);
const kdv = readFileSync(
  join(here, '../../../../web/src/components/ui/MasrafKdvOranInput.tsx'),
  'utf8',
);

describe('masraf alt grup tek üst LOCK', () => {
  it('aynı adlı alt grup başka ana gruba yazılmaz; çift liste kapısı durur', () => {
    assert.match(service, /assertSubgroupNameUnique/);
    assert.match(service, /findDuplicateSubgroups/);
    assert.match(service, /birden fazla masraf grubuna bağlanamaz/);
    assert.match(ctrl, /duplicate-subgroups/);
    assert.ok(
      ctrl.indexOf('duplicate-subgroups') < ctrl.indexOf('expense-categories/:id'),
      'duplicate-subgroups :id’den önce durur',
    );
    assert.match(ayar, /masraf-alt-grup-cift-liste/);
    assert.match(ayar, /masraf-alt-grup-envanter/);
    assert.match(ayar, /duplicate-subgroups/);
    assert.match(ayar, /birden fazla masraf grubuna bağlanamaz/);
  });

  it('tutar +−×÷ ile işlem özeti; KDV oranı klavyeden yazılır', () => {
    assert.match(calc, /İşlem:/);
    assert.match(calc, /OP_KEYS/);
    assert.match(calc, /evaluateAmountExpression/);
    assert.match(calc, /h-7 w-7/);
    assert.match(calc, /pr-\[4\.25rem\]/);
    assert.doesNotMatch(calc, /flex items-start gap-2/);
    assert.doesNotMatch(calc, /grid-cols-4/);
    assert.match(kdv, /masraf-kdv-oran-liste|masraf-kdv-oran/);
    assert.match(kdv, /startsWith/);
  });

  it('SearchableSelect odaklanınca tüm metin seçilir; ok tuşları çalışır', () => {
    const select = readFileSync(
      join(here, '../../../../web/src/components/ui/SearchableSelect.tsx'),
      'utf8',
    );
    assert.match(select, /selectAllOnFocus/);
    assert.match(select, /ArrowDown/);
    assert.match(select, /ArrowUp/);
    assert.match(select, /\.select\(\)/);
  });
});
