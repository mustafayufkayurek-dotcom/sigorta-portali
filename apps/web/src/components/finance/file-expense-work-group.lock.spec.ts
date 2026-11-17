import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = dirname(fileURLToPath(import.meta.url));
const root = join(dir, '../../../../..');

describe('masraf kalemi UI LOCK', () => {
  it('dosya masraf formu masraf kalemi gösterir; satırdan ekler; iş grubu alanı yoktur', () => {
    const form = readFileSync(
      join(root, 'apps/web/src/components/finance/ClaimFileExpenseFormPanel.tsx'),
      'utf8',
    );
    assert.match(form, /claim-file-masraf-kalem/);
    assert.match(form, /Masraf Kalemi/);
    assert.match(form, /\+ Yeni Masraf Grubu Ekle/);
    assert.match(form, /\+ Yeni Alt Grup Ekle/);
    assert.match(form, /createAction/);
    assert.match(form, /expense-categories/);
    assert.doesNotMatch(form, /FileWorkGroupExpenseFields/);
    assert.doesNotMatch(form, /useWorkGroupPath/);
    assert.match(form, /claim-file-expense-plan/);
    assert.match(form, /Bütçelenen/);
    assert.match(form, /Ek İş/);
    assert.match(form, /claim-file-masraf-cari/);
    assert.match(form, /Ödeme Kaynağı \(Cari\)/);
    assert.match(form, /Cari Kartı Aç/);
    assert.match(form, /CariHesapCreateModal/);
    assert.match(form, /CariHesapOzetModal/);
    assert.match(form, /claim-file-yeni-cari/);
    assert.match(form, /claim-file-cari-ozet-ac/);
    assert.doesNotMatch(form, /ensure-vendor/);
    assert.doesNotMatch(form, /Kayıt Sonrası Oluşur/);
    assert.match(form, /\(Zorunlu\)/);
    assert.match(form, /placeholder=\{ACIKLAMA_YARDIM\.masraf\}/);
    const filePanel = readFileSync(
      join(root, 'apps/web/src/components/finance/FileMasrafIsleme.tsx'),
      'utf8',
    );
    assert.match(filePanel, /allowExtraWorkPlan=\{true\}/);
    assert.match(filePanel, /hasar-masraf-butce-ek-seridi/);
    assert.match(filePanel, /FinansMetricGrid/);
    assert.match(filePanel, /Meridyen Operasyon Gideri/);
    assert.match(filePanel, /id="meridyen-operasyon-gideri"/);
    const plannerCost = readFileSync(
      join(root, 'apps/web/src/components/hasar-operasyon-planlayicisi/PlannerFileCostEntry.tsx'),
      'utf8',
    );
    assert.match(plannerCost, /ClaimFileExpenseFormPanel/);
    assert.match(plannerCost, /allowExtraWorkPlan=\{true\}/);
  });

  it('finans masraflar sayfası masraf kalemi kullanır; iş grubu seçici yoktur', () => {
    const page = readFileSync(
      join(root, 'apps/web/src/app/panel/finans/masraflar/page.tsx'),
      'utf8',
    );
    assert.match(page, /masraf-kalem-alanlari/);
    assert.match(page, /Masraf Kalemi/);
    assert.match(page, /\+ Yeni Masraf Grubu Ekle/);
    assert.match(page, /\+ Yeni Alt Grup Ekle/);
    assert.match(page, /finans-masraf-plan/);
    assert.match(page, /Bütçelenen/);
    assert.match(page, /masraf-cari-kart/);
    assert.match(page, /Cari Kartı Aç/);
    assert.doesNotMatch(page, /FileWorkGroupExpenseFields/);
    assert.doesNotMatch(page, /İş Grubu \/ İş Tanımı/);
    // Bütçe uygunluğu için audit hâlâ okunabilir; seçim alanı iş grubu değildir.
    assert.match(page, /work-group-audit/);
  });

  it('API isteğe bağlı iş grubu bütçe denetimini korur', () => {
    const svc = readFileSync(
      join(root, 'apps/backend/src/modules/expenses/expenses.service.ts'),
      'utf8',
    );
    assert.match(svc, /assertWorkGroupExpenseBudget/);
    assert.match(svc, /getWorkGroupExpenseAudit/);
    const ctrl = readFileSync(
      join(root, 'apps/backend/src/modules/expenses/expenses.controller.ts'),
      'utf8',
    );
    assert.match(ctrl, /work-group-audit/);
  });
});
