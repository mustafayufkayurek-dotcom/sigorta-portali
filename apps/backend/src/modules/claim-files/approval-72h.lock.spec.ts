/**
 * Kilit: dosyada onay alınmışsa 72s eksper hatırlatması gitmez.
 * Çalıştır: node --experimental-strip-types --test apps/backend/src/modules/claim-files/approval-72h.lock.spec.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  shouldSendApproval72hReminder,
} from './approval-72h.rule.ts';

const here = dirname(fileURLToPath(import.meta.url));
const scheduler = readFileSync(join(here, 'approval-72h.scheduler.ts'), 'utf8');

const pending = {
  id: 'old',
  status: 'pending_approval',
  versionNo: 0,
  createdAt: '2026-01-01',
};
const approved = {
  id: 'new',
  status: 'approved',
  versionNo: 1,
  createdAt: '2026-02-01',
};

describe('72s onay hatırlatması — onay alınmış dosya LOCK', () => {
  it('yeni rapor onaylıysa eski bekleyen satır mail düşürmez', () => {
    assert.equal(
      shouldSendApproval72hReminder({
        claimStatusCode: 'budget_submitted',
        reports: [pending, approved],
      }),
      false,
    );
  });

  it('revizyon bekliyorsa (eski onaylı, yeni bekliyor) hatırlatma durur', () => {
    assert.equal(
      shouldSendApproval72hReminder({
        claimStatusCode: 'budget_submitted',
        reports: [
          { ...approved, id: 'eski', versionNo: 0 },
          { ...pending, id: 'revizyon', versionNo: 1, createdAt: '2026-03-01' },
        ],
      }),
      true,
    );
  });

  it('onarım / fatura / kapalı dosyada hatırlatma yok', () => {
    const waitingOnly = [pending];
    assert.equal(
      shouldSendApproval72hReminder({
        claimStatusCode: 'repair_in_progress',
        reports: waitingOnly,
      }),
      false,
    );
    assert.equal(
      shouldSendApproval72hReminder({
        claimStatusCode: 'invoice_submitted',
        reports: waitingOnly,
      }),
      false,
    );
    assert.equal(
      shouldSendApproval72hReminder({
        claimClosed: true,
        claimStatusCode: 'closed',
        reports: waitingOnly,
      }),
      false,
    );
  });

  it('dış onay kaydı onaylıysa rapor bekliyor görünse de mail yok', () => {
    assert.equal(
      shouldSendApproval72hReminder({
        claimStatusCode: 'budget_submitted',
        reports: [
          {
            id: 'r1',
            status: 'sent_for_external_approval',
            versionNo: 0,
            createdAt: '2026-01-01',
            latestExternalApprovalStatus: 'approved',
          },
        ],
      }),
      false,
    );
  });

  it('gerçekten onay bekleyen açık dosyada hatırlatma gider', () => {
    assert.equal(
      shouldSendApproval72hReminder({
        claimStatusCode: 'budget_submitted',
        reports: [pending],
      }),
      true,
    );
  });

  it('saatlik tarama kapalı dosyayı ve onay kapısını kullanır', () => {
    assert.match(scheduler, /isClosedState:\s*false/);
    assert.match(scheduler, /shouldSendApproval72hReminder/);
  });
});
