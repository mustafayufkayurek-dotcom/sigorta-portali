/**
 * Acil’de sözleşme / dijital servis formu zorunlu değildir.
 * Çalıştır: node --experimental-strip-types --test packages/shared/src/acil-digital-approval-pause.lock.spec.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  acilDigitalApprovalGateOk,
  isAcilDigitalApprovalRequired,
} from './acil-digital-approval-pause.ts';

const here = dirname(fileURLToPath(import.meta.url));

describe('acil dijital onay / sözleşme LOCK', () => {
  it('Acil’de sözleşme kapısı kapalı; Hasar yolu yok', () => {
    assert.equal(isAcilDigitalApprovalRequired(new Date('2026-08-28T17:59:00+03:00')), false);
    assert.equal(isAcilDigitalApprovalRequired(new Date('2026-08-28T18:01:00+03:00')), false);
    assert.equal(acilDigitalApprovalGateOk(false, new Date('2026-08-28T18:01:00+03:00')), true);
    const gates = readFileSync(
      join(here, '../../../apps/web/src/components/acil-operasyon-planlayicisi/planner-gates.ts'),
      'utf8',
    );
    const chain = readFileSync(
      join(here, '../../../apps/backend/src/modules/emergency/emergency-operation-chain.ts'),
      'utf8',
    );
    const invoice = readFileSync(
      join(here, '../../../apps/backend/src/modules/invoice-requests/invoice-requests.service.ts'),
      'utf8',
    );
    assert.doesNotMatch(gates, /Servis onay formu dijital onayı olmadan/);
    assert.match(chain, /isAcilDigitalApprovalRequired/);
    assert.match(invoice, /isAcilDigitalApprovalRequired/);
    assert.doesNotMatch(invoice, /claimFileId.*isAcilDigitalApprovalRequired/);
    assert.match(invoice, /İptal açıklaması zorunlu/);
  });
});
