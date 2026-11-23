/**
 * Masraf alt grubu → üst grup bağından grup bazlı rapor.
 * Çalıştır: node --experimental-strip-types --test packages/shared/src/expense-masraf-grup.lock.spec.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  aggregateMasrafByGrup,
  resolveMasrafGrupBaglam,
} from './expense-masraf-grup.ts';

const here = dirname(fileURLToPath(import.meta.url));

describe('masraf grup bazlı rapor LOCK', () => {
  it('alt grup üst gruba bağlanır; özet grup adını parent’tan alır', () => {
    const bagli = resolveMasrafGrupBaglam({
      amount: 100,
      expenseGroup: 'OPERASYON_GIDERLERI',
      expenseCategory: {
        id: 'sub-1',
        name: 'Yemek Giderleri',
        parentId: 'grp-seyahat',
        parent: { id: 'grp-seyahat', name: 'Seyahat Giderleri' },
      },
    });
    assert.equal(bagli.groupId, 'grp-seyahat');
    assert.equal(bagli.groupName, 'Seyahat Giderleri');
    assert.equal(bagli.subgroupName, 'Yemek Giderleri');

    const ozet = aggregateMasrafByGrup([
      {
        amount: 100,
        expenseGroup: 'OPERASYON_GIDERLERI',
        expenseCategory: {
          id: 'sub-1',
          name: 'Yemek Giderleri',
          parent: { id: 'grp-seyahat', name: 'Seyahat Giderleri' },
        },
      },
      {
        amount: 50,
        expenseGroup: 'OPERASYON_GIDERLERI',
        expenseCategory: {
          id: 'sub-2',
          name: 'Konaklama',
          parent: { id: 'grp-seyahat', name: 'Seyahat Giderleri' },
        },
      },
      {
        amount: 200,
        expenseGroup: 'YONETIM_GIDERLERI',
        expenseCategory: {
          id: 'grp-yon',
          name: 'Yönetim Giderleri',
          parent: null,
        },
      },
    ]);
    assert.equal(ozet.length, 2);
    const seyahat = ozet.find((g) => g.groupName === 'Seyahat Giderleri');
    const yonetim = ozet.find((g) => g.groupName === 'Yönetim Giderleri');
    assert.ok(seyahat);
    assert.equal(seyahat?.amount, 150);
    assert.equal(seyahat?.subgroups.length, 2);
    assert.equal(yonetim?.amount, 200);
    // Enum’a düşmez — parent adı esas
    assert.ok(!ozet.some((g) => g.groupName === 'Operasyon Giderleri' && g.amount === 150));
  });

  it('backend özet ve masraf ekranı grup bağını kullanır', () => {
    const service = readFileSync(
      join(here, '../../../apps/backend/src/modules/expenses/expenses.service.ts'),
      'utf8',
    );
    const masraf = readFileSync(
      join(here, '../../../apps/web/src/app/panel/finans/masraflar/page.tsx'),
      'utf8',
    );
    const resolver = readFileSync(
      join(here, '../../../apps/backend/src/modules/expenses/expense-category-resolver.util.ts'),
      'utf8',
    );
    assert.match(service, /aggregateMasrafByGrup/);
    assert.match(service, /byMasrafGrubu/);
    assert.match(service, /expenseCategoryParentId/);
    assert.match(resolver, /Masraf alt grubunun ana grubu bulunamadı/);
    assert.match(masraf, /masraf-grup-dagilim/);
    assert.match(masraf, /Masraf Grubu Dağılımı/);
    assert.match(masraf, /fGroup|expenseCategoryParentId/);
    assert.match(masraf, /masraf-filtre-grup/);
  });
});
