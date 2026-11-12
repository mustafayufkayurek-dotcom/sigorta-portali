/**
 * Kilit: sözlü karar mailinde müşteri adı dosya numarasının üstündedir.
 * Çalıştır: node --experimental-strip-types --test apps/backend/src/modules/notifications/email/manual-decision-email.lock.spec.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));

describe('manuel karar maili müşteri satırı LOCK', () => {
  it('özette müşteri dosya numarasının üstündedir', () => {
    const src = readFileSync(join(here, 'claim-event-email.service.ts'), 'utf8');
    const start = src.indexOf('async onManualDecision');
    const end = src.indexOf('async onInspectionPlanned');
    const body = src.slice(start, end);
    const customerAt = body.indexOf("{ label: 'Müşteri', value: params.customerName?.trim() || '—' }");
    const fileAt = body.indexOf("{ label: 'Dosya No', value: params.fileNo }");
    assert.ok(customerAt >= 0);
    assert.ok(fileAt > customerAt);
  });

  it('Hasar ve Acil karttaki müşteri adını yollar', () => {
    const hasar = readFileSync(
      join(here, '../../claim-files/claim-operation-center.service.ts'),
      'utf8',
    );
    const acil = readFileSync(
      join(here, '../../emergency/emergency-cases.service.ts'),
      'utf8',
    );
    assert.match(hasar, /customerName: customerTitle/);
    assert.match(acil, /customerName,/);
    assert.match(acil, /resolveCustomerReminderTitle\(emergencyCase\.customer\)/);
  });
});
