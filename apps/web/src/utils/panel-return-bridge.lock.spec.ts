/**
 * Açık form → Tedarikçi ekle → dönüş köprüsü.
 * Çalıştır: node --experimental-strip-types --test apps/web/src/utils/panel-return-bridge.lock.spec.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  appendSelectVendorToReturn,
  buildTedarikciAddFromHref,
  isSafePanelReturnTo,
  parsePanelReturnBridge,
  readSelectVendorId,
} from './panel-return-bridge.ts';
import {
  CLAIM_FILE_EXPENSE_DRAFT_KEY,
  MASRAF_FORM_DRAFT_KEY,
} from './masraf-form-draft.ts';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '../../../..');

describe('panel return bridge LOCK', () => {
  it('returnTo yalnız panel yolu; tedarikçi ekleme ve selectVendorId durur', () => {
    assert.equal(isSafePanelReturnTo('/panel/finans/masraflar?yeni=1'), true);
    assert.equal(isSafePanelReturnTo('https://evil.example/'), false);
    const href = buildTedarikciAddFromHref({
      returnTo: '/panel/finans/masraflar?yeni=1',
      returnLabel: 'Masraf',
      scope: 'ofis',
    });
    assert.match(href, /^\/panel\/tedarikciler\?/);
    assert.match(href, /openAdd=1/);
    assert.match(href, /returnLabel=Masraf/);
    assert.match(href, /scope=ofis/);
    const back = appendSelectVendorToReturn('/panel/finans/masraflar?yeni=1', 'vend-1');
    assert.match(back, /selectVendorId=vend-1/);
    assert.match(back, /yeni=1/);
    const params = new URLSearchParams(back.split('?')[1] ?? '');
    assert.equal(readSelectVendorId(params), 'vend-1');
    assert.deepEqual(
      parsePanelReturnBridge(new URLSearchParams('returnTo=/panel/finans/masraflar&returnLabel=Masraf')),
      { returnTo: '/panel/finans/masraflar', returnLabel: 'Masraf' },
    );
  });

  it('masraf Yeni Tedarikçi sayfada kalır; taslak dönüş yedeği durur', () => {
    const masraf = readFileSync(join(root, 'apps/web/src/app/panel/finans/masraflar/page.tsx'), 'utf8');
    const claimExpense = readFileSync(
      join(root, 'apps/web/src/components/finance/ClaimFileExpenseFormPanel.tsx'),
      'utf8',
    );
    const vendors = readFileSync(join(root, 'apps/web/src/app/panel/tedarikciler/page.tsx'), 'utf8');
    assert.equal(MASRAF_FORM_DRAFT_KEY, 'meridyen:masraf-form-draft');
    assert.equal(CLAIM_FILE_EXPENSE_DRAFT_KEY, 'meridyen:claim-file-expense-draft');
    assert.match(masraf, /takeMasrafFormDraft/);
    assert.match(masraf, /VendorQuickCreateModal/);
    assert.match(masraf, /data-testid="masraf-yeni-tedarikci"/);
    assert.match(masraf, /readSelectVendorId/);
    assert.doesNotMatch(masraf, /buildTedarikciAddFromHref/);
    assert.match(claimExpense, /takeClaimFileExpenseDraft/);
    assert.match(claimExpense, /VendorQuickCreateModal/);
    assert.match(claimExpense, /data-testid="dosya-masraf-yeni-tedarikci"/);
    assert.doesNotMatch(claimExpense, /buildTedarikciAddFromHref/);
    assert.match(vendors, /parsePanelReturnBridge/);
    assert.match(vendors, /appendSelectVendorToReturn/);
    assert.match(vendors, /openAdd/);
    assert.match(vendors, /tedarikci-return-bridge/);
    const detail = readFileSync(join(root, 'apps/web/src/app/panel/tedarikciler/[id]/page.tsx'), 'utf8');
    assert.match(detail, /tedarikci-ofis-finans-iz/);
    assert.match(detail, /Finans → Masraflar/);
  });
});
