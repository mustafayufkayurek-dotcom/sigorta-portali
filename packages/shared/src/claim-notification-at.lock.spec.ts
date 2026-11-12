/**
 * İhbar saati gün olarak gelince 03:00 basılmaz. Broker varsa Sigorta Şirketi’nin üstünde durur.
 * Çalıştır: node --experimental-strip-types --test packages/shared/src/claim-notification-at.lock.spec.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  formatClaimNotificationAt,
  normalizeClaimNotificationDate,
} from './claim-notification-at.ts';

const root = join(dirname(fileURLToPath(import.meta.url)), '../../..');
const src = (path: string) => readFileSync(join(root, path), 'utf8');

describe('ihbar saati LOCK', () => {
  it('2026 YE 1845/1: gün kaydı açılış saatini gösterir', () => {
    const notified = '2026-11-12T00:00:00.000Z';
    const created = '2026-11-12T19:44:00.000Z';
    assert.equal(formatClaimNotificationAt(notified, created), '12.11.2026 22:44');
  });

  it('geçmiş gün kaydı uydurma saat basmaz', () => {
    assert.equal(formatClaimNotificationAt('2026-11-10T00:00:00.000Z', '2026-11-12T19:44:00.000Z'), '10.11.2026');
  });

  it('gerçek saat olduğu gibi durur', () => {
    assert.equal(formatClaimNotificationAt('2026-11-12T11:15:23.120Z', null), '12.11.2026 14:15');
  });

  it('kayıtta bugünün günü kayıt anına çekilir', () => {
    const now = new Date('2026-11-12T19:44:10.500Z');
    assert.equal(normalizeClaimNotificationDate('2026-11-12T00:00:00.000Z', now)?.toISOString(), now.toISOString());
    assert.equal(
      normalizeClaimNotificationDate('2026-11-10T00:00:00.000Z', now)?.toISOString(),
      '2026-11-10T00:00:00.000Z',
    );
  });

  it('mail kartı, kayıt ve kapanış aynı kuralı kullanır', () => {
    const ihbar = src('apps/backend/src/modules/operation-inbox/inbox-ihbar-email.ts');
    assert.match(ihbar, /formatClaimNotificationAt\(summary\.notificationAt, summary\.fileCreatedAt\)/);
    assert.match(ihbar, /label: 'Broker'/);
    assert.ok(ihbar.indexOf("label: 'Broker'") < ihbar.indexOf('rows.push({ label: companyLabel'));
    const service = src('apps/backend/src/modules/claim-files/claim-files.service.ts');
    assert.match(service, /normalizeClaimNotificationDate\(rest\.notificationDate\)/);
    assert.match(service, /fileSubject: claimFileSubjectName\(created\)/);
    assert.match(service, /fileSubject: claimFileSubjectName\(claimFile as any\)/);
    assert.doesNotMatch(service, /notificationAt: created\.notificationDate \|\| created\.createdAt/);
    const closure = src('apps/backend/src/modules/notifications/email/file-closure-email.template.ts');
    assert.match(closure, /formatClaimNotificationAt\(data\.notificationAt, data\.fileCreatedAt\)/);
  });
});
