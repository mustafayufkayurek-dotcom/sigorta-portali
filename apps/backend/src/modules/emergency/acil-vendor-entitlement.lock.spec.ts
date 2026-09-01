/**
 * Kilit: Acil hakediş dosya bazlı, tarih-saatli, vade yok. Hasar 15/30 vade buraya girmez.
 * Çalıştır: node --experimental-strip-types --test apps/backend/src/modules/emergency/acil-vendor-entitlement.lock.spec.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  acilHakedisActorName,
  acilHakedisDueDate,
  acilHakedisFinanceNote,
  acilHakedisOutgoingStatus,
  acilHakedisPaidDescription,
  acilHakedisPaymentRef,
  pickAcilHakedisAmount,
} from './acil-vendor-entitlement.ts';

const here = dirname(fileURLToPath(import.meta.url));

describe('acil vendor entitlement LOCK', () => {
  it('tutarı dosya giderinden alır', () => {
    assert.equal(
      pickAcilHakedisAmount(
        [
          { entryType: 'gider', amount: 950, vendorId: 'v1' },
          { entryType: 'gelir', amount: 1350, vendorId: null },
        ],
        'v1',
      ),
      950,
    );
  });

  it('vade üretmez', () => {
    assert.equal(acilHakedisDueDate(15), null);
    assert.equal(acilHakedisDueDate(30), null);
    assert.match(acilHakedisFinanceNote(new Date('2026-08-21T14:40:00+03:00')), /Vade yok/);
  });

  it('Hasar statement / paymentDueDays yoluna bağlanmaz', () => {
    const svc = readFileSync(join(here, 'emergency-finance.service.ts'), 'utf8');
    assert.match(svc, /emergencyVendorEntitlement/);
    assert.match(svc, /ensureAcilHakedisOutgoingPayment/);
    assert.match(svc, /acilHakedisPaymentRef/);
    assert.doesNotMatch(svc, /paymentDueDays/);
    assert.doesNotMatch(svc, /VendorPaymentStatement/);
    const chain = readFileSync(join(here, 'emergency-operation-chain.ts'), 'utf8');
    assert.match(chain, /vendorEntitlementGrantedAt/);
    assert.match(chain, /Vade yok/);
    assert.match(chain, /paymentRequiresClaimFile: false/);
    assert.match(chain, /Ödenecekler kuyruğunda/);
    const payments = readFileSync(join(here, '../payments/payments.service.ts'), 'utf8');
    assert.match(payments, /acil_hakedis/);
    assert.match(payments, /emergencyCaseId/);
    assert.match(payments, /vendorPaid: true/);
    const schema = readFileSync(join(here, '../../../prisma/schema.prisma'), 'utf8');
    assert.match(schema, /emergencyCaseId String\?  @unique/);
    assert.match(schema, /claimFileId     String\?/);
    assert.match(schema, /vendorPaidByUserId/);
    assert.match(schema, /EmergencyVendorPaidBy/);
  });

  it('Ödendi damgası kuyrukta tamamlanır; aksi halde bekler', () => {
    assert.equal(acilHakedisPaymentRef('case-1'), 'ACIL-HAKEDIS:case-1');
    assert.equal(acilHakedisOutgoingStatus(true), 'completed');
    assert.equal(acilHakedisOutgoingStatus(false), 'pending');
    assert.equal(acilHakedisOutgoingStatus(null), 'pending');
  });

  it('işlemi yapan adıyla yazılır', () => {
    assert.equal(acilHakedisActorName({ firstName: 'Ayşe', lastName: 'Kaya' }), 'Ayşe Kaya');
    assert.match(
      acilHakedisPaidDescription({ paid: true, actorName: 'Ayşe Kaya', source: 'file' }),
      /ödendi · Ayşe Kaya \(dosya\)/,
    );
    assert.match(
      acilHakedisPaidDescription({ paid: true, actorName: 'Mehmet Demir', source: 'finance_queue' }),
      /ödendi · Mehmet Demir \(ödemeler\)/,
    );
    const payments = readFileSync(join(here, '../payments/payments.service.ts'), 'utf8');
    assert.match(payments, /recordAcilHakedisPaidBy/);
    assert.match(payments, /finance_queue/);
    const cases = readFileSync(join(here, 'emergency-cases.service.ts'), 'utf8');
    assert.match(cases, /vendorPaidByUserId/);
    assert.match(cases, /Finansa aktarıldıktan sonra ödendi işlemini finans personeli yapar/);
    const steps = readFileSync(
      join(here, '../../../../web/src/components/acil-operasyon-planlayicisi/planner-steps.tsx'),
      'utf8',
    );
    assert.match(steps, /acil-odeme-islem-yapan/);
    assert.match(steps, /Finansa aktarıldı; ödendi işlemini finans personeli yapar/);
  });
});
