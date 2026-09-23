import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  PAYMENT_RECORD_ACCESS_MESSAGE,
  canViewPaymentRecord,
  officeStaffOwnsPaymentFile,
} from './payment-record-access.ts';

const here = dirname(fileURLToPath(import.meta.url));

describe('ödeme kayıt sahipliği LOCK', () => {
  it('ofis yalnız kendi dosyasının ödemesini açar', () => {
    assert.equal(
      officeStaffOwnsPaymentFile('ofis-1', { assignedOfficeUserId: 'ofis-1' }, null),
      true,
    );
    assert.equal(
      officeStaffOwnsPaymentFile('ofis-1', { assignedOfficeUserId: 'ofis-2' }, null),
      false,
    );
    assert.equal(
      canViewPaymentRecord({
        roleCode: 'office_staff',
        userId: 'ofis-1',
        claimFile: { assignedOfficeUserId: 'ofis-2' },
      }),
      false,
    );
    assert.equal(
      canViewPaymentRecord({
        roleCode: 'finans',
        userId: 'fin-1',
        claimFile: { assignedOfficeUserId: 'ofis-2' },
      }),
      true,
    );
  });

  it('Acil satırında atanan ofis / saha durur', () => {
    assert.equal(
      canViewPaymentRecord({
        roleCode: 'office_staff',
        userId: 'ofis-1',
        emergencyCase: { assignedUserId: 'ofis-1' },
      }),
      true,
    );
    assert.equal(
      canViewPaymentRecord({
        roleCode: 'office_staff',
        userId: 'ofis-1',
        emergencyCase: { assignedUserId: 'baska' },
      }),
      false,
    );
  });

  it('ödeme servisi bu kapıyı kullanır', () => {
    const service = readFileSync(
      join(here, '../../../apps/backend/src/modules/payments/payments.service.ts'),
      'utf8',
    );
    assert.match(service, /canViewPaymentRecord/);
    assert.match(service, /PAYMENT_RECORD_ACCESS_MESSAGE/);
    const tab = readFileSync(
      join(here, '../../../apps/web/src/app/panel/hasar-dosyalari/[id]/_components/tabs/finans-subtabs.tsx'),
      'utf8',
    );
    assert.match(tab, /PAYMENT_RECORD_ACCESS_MESSAGE/);
    assert.equal(PAYMENT_RECORD_ACCESS_MESSAGE, 'Bu kayda erişiminiz yok.');
  });
});
