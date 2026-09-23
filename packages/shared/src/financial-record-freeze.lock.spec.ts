import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  FINANCIAL_CORRECTION_ADMIN_MESSAGE,
  FINANCIAL_CORRECTION_NEEDED,
  FINANCIAL_FREEZE_MESSAGE,
  evaluateFrozenFinanceUpdate,
  financePaymentStatusLabel,
  isPaidOrApprovedFinanceStatus,
} from './financial-record-freeze.ts';

const here = dirname(fileURLToPath(import.meta.url));

describe('ödenmiş finansal kayıt dondurma LOCK', () => {
  it('ödenmiş tutar / tarih / yöntem kilitlidir', () => {
    const blocked = evaluateFrozenFinanceUpdate({
      currentStatus: 'completed',
      touchesMoneyFields: true,
      actorIsAdmin: true,
    });
    assert.equal(blocked.ok, false);
    if (!blocked.ok) assert.equal(blocked.message, FINANCIAL_FREEZE_MESSAGE);
    assert.equal(isPaidOrApprovedFinanceStatus('paid'), true);
    assert.equal(isPaidOrApprovedFinanceStatus('APPROVED'), true);
  });

  it('bekleyen kaydı Ödendi yapmak serbesttir', () => {
    const ok = evaluateFrozenFinanceUpdate({
      currentStatus: 'pending',
      nextStatus: 'completed',
      touchesMoneyFields: false,
      actorIsAdmin: false,
    });
    assert.equal(ok.ok, true);
  });

  it('düzeltmeyi yalnız yönetici açar; aynı anda tutar değişmez', () => {
    const staff = evaluateFrozenFinanceUpdate({
      currentStatus: 'completed',
      nextStatus: FINANCIAL_CORRECTION_NEEDED,
      touchesMoneyFields: false,
      actorIsAdmin: false,
    });
    assert.equal(staff.ok, false);
    if (!staff.ok) assert.equal(staff.message, FINANCIAL_CORRECTION_ADMIN_MESSAGE);
    const money = evaluateFrozenFinanceUpdate({
      currentStatus: 'completed',
      nextStatus: FINANCIAL_CORRECTION_NEEDED,
      touchesMoneyFields: true,
      actorIsAdmin: true,
    });
    assert.equal(money.ok, false);
    const open = evaluateFrozenFinanceUpdate({
      currentStatus: 'completed',
      nextStatus: FINANCIAL_CORRECTION_NEEDED,
      touchesMoneyFields: false,
      actorIsAdmin: true,
    });
    assert.equal(open.ok, true);
    const after = evaluateFrozenFinanceUpdate({
      currentStatus: FINANCIAL_CORRECTION_NEEDED,
      touchesMoneyFields: true,
      actorIsAdmin: false,
    });
    assert.equal(after.ok, true);
  });

  it('ödeme ve fatura güncellemesi bu kuralı kullanır', () => {
    const payments = readFileSync(
      join(here, '../../../apps/backend/src/modules/payments/payments.service.ts'),
      'utf8',
    );
    const invoices = readFileSync(
      join(here, '../../../apps/backend/src/modules/invoices/invoices.service.ts'),
      'utf8',
    );
    const acil = readFileSync(
      join(here, '../../../apps/backend/src/modules/emergency/emergency-finance.service.ts'),
      'utf8',
    );
    assert.match(payments, /evaluateFrozenFinanceUpdate/);
    assert.match(payments, /FINANCE_ADJUST/);
    assert.match(invoices, /evaluateFrozenFinanceUpdate/);
    assert.match(acil, /isPaidOrApprovedFinanceStatus/);
    assert.equal(financePaymentStatusLabel('correction_needed'), 'Düzeltme Gerekli');
  });
});
