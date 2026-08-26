/**
 * Kilit: Operasyon / Hasar listesi e-posta = dış onay. Taslak PDF yedek yolu yok.
 * Çalıştır: node --experimental-strip-types --test apps/web/src/components/operasyon/operation-send-email-approval.lock.spec.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const specDir = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(join(specDir, 'OperationSendEmailModal.tsx'), 'utf8');

describe('liste onay maili LOCK', () => {
  it('sendPlannerApprovalMail kullanır; taslak PDF yolu yok', () => {
    assert.match(src, /sendPlannerApprovalMail/);
    assert.doesNotMatch(src, /repair-reports\/\$\{[^}]+\}\/send-email/);
  });
});
