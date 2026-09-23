import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import {
  PUBLIC_APPROVAL_TOKEN_CLOSED_MESSAGE,
  PUBLIC_APPROVAL_TOKEN_MAX_MS,
  evaluatePublicApprovalToken,
  publicApprovalTokenErrorMessage,
} from './public-approval-token.ts';

const DAY = 24 * 60 * 60 * 1000;
const now = new Date('2026-09-23T12:00:00.000Z');

describe('dış onay linki 7 gün ve işlem sonrası kilit LOCK', () => {
  it('onay veya imza sonrası dış erişim kapanır', () => {
    assert.equal(
      evaluatePublicApprovalToken({
        createdAt: now,
        digitallyApprovedAt: now,
        now,
      }).ok,
      false,
    );
    assert.deepEqual(
      evaluatePublicApprovalToken({
        createdAt: now,
        status: 'vendor_signed',
        signedAt: now,
        now,
      }),
      { ok: false, reason: 'closed' },
    );
    assert.deepEqual(
      evaluatePublicApprovalToken({
        createdAt: now,
        status: 'rejected',
        now,
      }),
      { ok: false, reason: 'closed' },
    );
    assert.equal(
      publicApprovalTokenErrorMessage('closed', 'evrak'),
      PUBLIC_APPROVAL_TOKEN_CLOSED_MESSAGE,
    );
  });

  it('7 gün işlem görmeyen link düşer; 7 gün içi açık kalır', () => {
    const fresh = new Date(now.getTime() - 6 * DAY);
    const stale = new Date(now.getTime() - 8 * DAY);
    assert.equal(
      evaluatePublicApprovalToken({
        createdAt: fresh,
        publicTokenExpiresAt: new Date(fresh.getTime() + 30 * DAY),
        now,
      }).ok,
      true,
    );
    assert.deepEqual(
      evaluatePublicApprovalToken({
        createdAt: stale,
        publicTokenExpiresAt: new Date(stale.getTime() + 30 * DAY),
        now,
      }),
      { ok: false, reason: 'expired' },
    );
    assert.ok(PUBLIC_APPROVAL_TOKEN_MAX_MS === 7 * DAY);
  });

  it('evrak ve sözleşme dış kapısı bu kuralı kullanır; oluşturma süresi satırına dokunulmaz', () => {
    const evrak = readFileSync(
      new URL('../../../apps/backend/src/modules/file-documents/file-documents.service.ts', import.meta.url),
      'utf8',
    );
    const sozlesme = readFileSync(
      new URL('../../../apps/backend/src/modules/vendor-contracts/vendor-contracts.service.ts', import.meta.url),
      'utf8',
    );
    assert.match(evrak, /evaluatePublicApprovalToken/);
    assert.match(sozlesme, /evaluatePublicApprovalToken/);
    assert.match(evrak, /PUBLIC_APPROVAL_TOKEN_CLOSED_MESSAGE/);
    assert.match(sozlesme, /PUBLIC_APPROVAL_TOKEN_CLOSED_MESSAGE/);
    const evrakPage = readFileSync(
      new URL('../../../apps/web/src/app/evrak/[token]/page.tsx', import.meta.url),
      'utf8',
    );
    const sozlesmePage = readFileSync(
      new URL('../../../apps/web/src/app/sozlesme/[token]/page.tsx', import.meta.url),
      'utf8',
    );
    assert.match(evrakPage, /PUBLIC_APPROVAL_TOKEN_CLOSED_MESSAGE/);
    assert.match(sozlesmePage, /PUBLIC_APPROVAL_TOKEN_CLOSED_MESSAGE/);
    assert.match(evrakPage, /error === PUBLIC_APPROVAL_TOKEN_CLOSED_MESSAGE/);
    assert.match(sozlesmePage, /error === PUBLIC_APPROVAL_TOKEN_CLOSED_MESSAGE/);
    assert.match(evrakPage, /bg-slate-100/);
    assert.match(sozlesmePage, /bg-slate-100/);
    const createEvrak = evrak.slice(0, evrak.indexOf('findByToken'));
    const createSozlesme = sozlesme.slice(0, sozlesme.indexOf('findByToken'));
    assert.match(createEvrak, /30 \* 24 \* 60 \* 60 \* 1000/);
    assert.match(createSozlesme, /30 \* 24 \* 60 \* 60 \* 1000/);
    assert.match(evrak, /updateMany/);
    assert.match(sozlesme, /updateMany/);
    assert.match(evrak, /digitallyApprovedAt: approvedAt\.toISOString/);
    assert.match(sozlesme, /signedAt: signedAt\.toISOString/);
    assert.match(evrak, /evaluatePublicApprovalToken\(doc\)/);
    assert.match(sozlesme, /evaluatePublicApprovalToken\(contract\)/);
    const evrakCtrl = readFileSync(
      new URL('../../../apps/backend/src/modules/file-documents/public-file-document.controller.ts', import.meta.url),
      'utf8',
    );
    const sozlesmeCtrl = readFileSync(
      new URL('../../../apps/backend/src/modules/vendor-contracts/public-contract.controller.ts', import.meta.url),
      'utf8',
    );
    assert.match(evrakCtrl, /PUBLIC_APPROVAL_TOKEN_CACHE_CONTROL/);
    assert.match(sozlesmeCtrl, /PUBLIC_APPROVAL_TOKEN_CACHE_CONTROL/);
    assert.match(evrakCtrl, /noStore\(res\)/);
    assert.match(sozlesmeCtrl, /noStore\(res\)/);
  });

  it('süre sunucu saati milisaniyesidir; yerel takvim farkı sonucu değiştirmez', () => {
    const issued = new Date('2026-09-16T09:00:00+03:00');
    const nowUtc = new Date('2026-09-23T12:00:00.000Z');
    const nowIstanbul = new Date('2026-09-23T15:00:00+03:00');
    assert.equal(nowUtc.getTime(), nowIstanbul.getTime());
    assert.deepEqual(
      evaluatePublicApprovalToken({ createdAt: issued, now: nowUtc }),
      { ok: false, reason: 'expired' },
    );
    assert.deepEqual(
      evaluatePublicApprovalToken({ createdAt: issued, now: nowIstanbul }),
      { ok: false, reason: 'expired' },
    );
    const stillOpen = new Date('2026-09-22T12:00:00.000Z');
    assert.equal(
      evaluatePublicApprovalToken({ createdAt: issued, now: stillOpen }).ok,
      true,
    );
  });

  it('iptal ve red de aynı anda kapatır', () => {
    assert.deepEqual(
      evaluatePublicApprovalToken({ createdAt: now, status: 'cancelled', now }),
      { ok: false, reason: 'closed' },
    );
    assert.deepEqual(
      evaluatePublicApprovalToken({ createdAt: now, status: 'digitally_rejected', now }),
      { ok: false, reason: 'closed' },
    );
  });
});
