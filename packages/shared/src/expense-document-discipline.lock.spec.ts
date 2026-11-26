/**
 * Çalıştır: node --experimental-strip-types --test packages/shared/src/expense-document-discipline.lock.spec.ts
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  EXPENSE_DOCUMENT_REVIEW_CODE,
  buildExpenseDocumentReviewPayload,
  expenseDocumentNosMatch,
  isValidExpenseDocumentOverrideReason,
  normalizeExpenseDocumentNo,
  shouldReviewExpenseDocument,
} from './expense-document-discipline.ts';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '../../..');

describe('masraf belge disiplini LOCK', () => {
  it('25 ≡ 025 ≡ 0025; boşluk ve büyük harf fark etmez', () => {
    assert.equal(normalizeExpenseDocumentNo('25'), '25');
    assert.equal(normalizeExpenseDocumentNo('025'), '25');
    assert.equal(normalizeExpenseDocumentNo('0025'), '25');
    assert.equal(normalizeExpenseDocumentNo('  25 '), '25');
    assert.ok(expenseDocumentNosMatch('25', '025'));
    assert.ok(expenseDocumentNosMatch('AB-12', 'ab-12'));
    assert.equal(expenseDocumentNosMatch('25', '26'), false);
  });

  it('belgesiz veya boş no kontrol edilmez', () => {
    assert.equal(shouldReviewExpenseDocument({ hasTaxDocument: false, receiptDocumentNo: '25' }), false);
    assert.equal(shouldReviewExpenseDocument({ hasTaxDocument: true, receiptDocumentNo: '' }), false);
    assert.equal(shouldReviewExpenseDocument({ hasTaxDocument: true, receiptDocumentNo: '25' }), true);
  });

  it('çakışma veya hakediş uyarısı payload üretir; yine de kaydet kısa teyitle ilerler', () => {
    const payload = buildExpenseDocumentReviewPayload({
      documentDuplicates: [
        {
          id: 'e1',
          receiptDocumentNo: '025',
          receiptDocumentType: 'Fatura',
          amount: 100,
          date: '2026-01-01',
        },
      ],
      hakedisWarnings: [
        {
          kind: 'acil',
          fileId: 'c1',
          fileNo: 'AY-1',
          vendorName: 'Çilingir',
          amount: 500,
          grantedAt: '2026-01-02',
          paid: false,
        },
      ],
    });
    assert.ok(payload);
    assert.equal(payload!.code, EXPENSE_DOCUMENT_REVIEW_CODE);
    assert.equal(payload!.requiresOverride, true);
    assert.match(payload!.message, /benzer belge no|kaydetmeye devam/i);
    assert.match(payload!.message, /hakediş/i);
    assert.equal(isValidExpenseDocumentOverrideReason(''), false);
    assert.equal(isValidExpenseDocumentOverrideReason('Benzer belge no ile devam (personel teyidi)'), true);
  });

  it('API ve form kontrol penceresini kullanır; Hasar ve Acil aynı kapı', () => {
    const shared = readFileSync(join(root, 'packages/shared/src/expense-document-discipline.ts'), 'utf8');
    const svc = readFileSync(join(root, 'apps/backend/src/modules/expenses/expenses.service.ts'), 'utf8');
    const ctrl = readFileSync(join(root, 'apps/backend/src/modules/expenses/expenses.controller.ts'), 'utf8');
    const dto = readFileSync(join(root, 'apps/backend/src/modules/expenses/dto/expenses.dto.ts'), 'utf8');
    const popup = readFileSync(
      join(root, 'apps/web/src/components/finance/ExpenseDocumentReviewModal.tsx'),
      'utf8',
    );
    const masraf = readFileSync(join(root, 'apps/web/src/app/panel/finans/masraflar/page.tsx'), 'utf8');
    const claim = readFileSync(
      join(root, 'apps/web/src/components/finance/ClaimFileExpenseFormPanel.tsx'),
      'utf8',
    );

    assert.match(shared, /normalizeExpenseDocumentNo/);
    assert.match(shared, /ExpenseHakedisFileKind/);
    assert.match(svc, /buildExpenseDocumentReview|evaluateExpenseDocumentReview|document-review/);
    assert.match(ctrl, /document-review/);
    assert.match(dto, /documentConflictOverrideReason/);
    assert.match(popup, /Kaydetmeye Devam Et/);
    assert.match(popup, /Belge No'yu Değiştir/);
    assert.match(popup, /onEditDocumentNo/);
    assert.match(popup, /EXPENSE_DOCUMENT_CONTINUE_REASON/);
    assert.match(popup, /Vazgeç/);
    assert.match(popup, /Mevcut Kaydı Aç/);
    assert.match(popup, /hakedisWarnings/);
    assert.match(popup, /Aynı Veya Benzer Belge No/);
    assert.doesNotMatch(popup, /Gerekçe İle Kaydet/);
    assert.match(masraf, /ExpenseDocumentReviewModal/);
    assert.match(masraf, /onEditDocumentNo/);
    assert.match(masraf, /expenses\/document-review/);
    assert.match(claim, /ExpenseDocumentReviewModal/);
    assert.match(claim, /onEditDocumentNo/);
    assert.match(claim, /expenses\/document-review/);
    assert.match(shared, /kaydetmeye devam edebilirsiniz/i);
    assert.match(svc, /acil|ACIL_YARDIM|EmergencyVendorEntitlement|vendorEntitlement/i);
    assert.match(svc, /VendorStatementItem|vendor_statement|claimFileId/i);
  });
});
