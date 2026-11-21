/**
 * Çalıştır: node --experimental-strip-types --test packages/shared/src/hasar-hakedis-budget-cap.lock.spec.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  HASAR_HAKEDIS_BUDGET_EXCEEDED_MESSAGE,
  assertHasarHakedisBudgetCap,
  hasarHakedisWorkGroupRemaining,
} from './hasar-hakedis-budget-cap.ts';

const here = dirname(fileURLToPath(import.meta.url));

describe('Hasar hakediş iş grubu bütçe tavanı LOCK', () => {
  it('10.000 bütçe, 0 verilen → 10.000 kalan; 10.000 talep geçer', () => {
    assert.equal(hasarHakedisWorkGroupRemaining(10_000, 0), 10_000);
    const ok = assertHasarHakedisBudgetCap({
      workGroupLabel: 'Boya İşleri',
      requested: 10_000,
      budgeted: 10_000,
      alreadyGranted: 0,
    });
    assert.equal(ok.ok, true);
  });

  it('10.000 bütçe, Ahmet için fazla talep reddedilir', () => {
    const bad = assertHasarHakedisBudgetCap({
      workGroupLabel: 'Boya İşleri',
      requested: 12_000,
      budgeted: 10_000,
      alreadyGranted: 0,
    });
    assert.equal(bad.ok, false);
    if (!bad.ok) {
      assert.match(bad.message, /aş/);
      assert.match(bad.message, /Boya/);
    }
  });

  it('verilmiş hakediş kalanı düşürür', () => {
    assert.equal(hasarHakedisWorkGroupRemaining(10_000, 4_000), 6_000);
    const bad = assertHasarHakedisBudgetCap({
      requested: 6_001,
      budgeted: 10_000,
      alreadyGranted: 4_000,
    });
    assert.equal(bad.ok, false);
  });

  it('grantHasarHakedis sunucuda tavanı kullanır', () => {
    const svc = readFileSync(
      join(here, '../../../apps/backend/src/modules/vendor-statements/vendor-statements.service.ts'),
      'utf8',
    );
    assert.match(svc, /assertHasarHakedisBudgetCap/);
    assert.match(svc, /resolveHasarWorkGroupBudgets/);
    assert.match(svc, /budgetVersion\.findFirst/);
    assert.match(svc, /Eski dosyalar dahil/);
    assert.match(svc, /iş grubu bütçe tavanı katıdır/);
  });

  it('mesaj sabiti durur', () => {
    assert.match(HASAR_HAKEDIS_BUDGET_EXCEEDED_MESSAGE, /bütçeyi aşıyor/i);
  });
});
