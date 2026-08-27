/**
 * Acil dijital onay 28.08.2026 18:01 TR itibarıyla tekrar zorunlu.
 * Çalıştır: node --experimental-strip-types --test packages/shared/src/acil-digital-approval-pause.lock.spec.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  ACIL_DIGITAL_APPROVAL_RESUME_ISO,
  acilDigitalApprovalGateOk,
  isAcilDigitalApprovalRequired,
} from './acil-digital-approval-pause.ts';

const here = dirname(fileURLToPath(import.meta.url));

describe('acil dijital onay geçici durdurma LOCK', () => {
  it('18:00’e kadar kapalı, 18:01’de açık; Hasar yolu yok', () => {
    assert.equal(ACIL_DIGITAL_APPROVAL_RESUME_ISO, '2026-08-28T18:01:00+03:00');
    assert.equal(isAcilDigitalApprovalRequired(new Date('2026-08-28T17:59:00+03:00')), false);
    assert.equal(isAcilDigitalApprovalRequired(new Date('2026-08-28T18:00:59+03:00')), false);
    assert.equal(isAcilDigitalApprovalRequired(new Date('2026-08-28T18:01:00+03:00')), true);
    assert.equal(acilDigitalApprovalGateOk(false, new Date('2026-08-28T18:00:00+03:00')), true);
    assert.equal(acilDigitalApprovalGateOk(false, new Date('2026-08-28T18:01:00+03:00')), false);
    assert.equal(acilDigitalApprovalGateOk(true, new Date('2026-08-28T18:01:00+03:00')), true);
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
    assert.match(gates, /2026-08-28T18:01:00\+03:00/);
    assert.match(chain, /isAcilDigitalApprovalRequired/);
    assert.match(invoice, /isAcilDigitalApprovalRequired/);
    assert.doesNotMatch(invoice, /claimFileId.*isAcilDigitalApprovalRequired/);
  });
});


describe('acil dijital onay geçici durdurma LOCK', () => {
  it('18:00’e kadar kapalı, 18:01’de açık; Hasar yolu yok', () => {
    assert.equal(ACIL_DIGITAL_APPROVAL_RESUME_ISO, '2026-08-28T18:01:00+03:00');
    assert.equal(isAcilDigitalApprovalRequired(new Date('2026-08-28T17:59:00+03:00')), false);
    assert.equal(isAcilDigitalApprovalRequired(new Date('2026-08-28T18:00:59+03:00')), false);
    assert.equal(isAcilDigitalApprovalRequired(new Date('2026-08-28T18:01:00+03:00')), true);
    assert.equal(acilDigitalApprovalGateOk(false, new Date('2026-08-28T18:00:00+03:00')), true);
    assert.equal(acilDigitalApprovalGateOk(false, new Date('2026-08-28T18:01:00+03:00')), false);
    assert.equal(acilDigitalApprovalGateOk(true, new Date('2026-08-28T18:01:00+03:00')), true);
  });
});
