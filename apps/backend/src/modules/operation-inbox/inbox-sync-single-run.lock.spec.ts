/**
 * PM2 iki kopya: aynı posta kutusunu aynı anda tek işlem çeker. Planlı tur tek iş koyar.
 * Graph hatası boş «senkron başarısız —» yazmaz.
 * Çalıştır: node --experimental-strip-types --test apps/backend/src/modules/operation-inbox/inbox-sync-single-run.lock.spec.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { inboxSyncLockKey, scheduledInboxSyncJobId } from './operation-inbox.constants.ts';

const here = dirname(fileURLToPath(import.meta.url));
const read = (p: string) => readFileSync(join(here, p), 'utf8');

describe('gelen kutusu tek eşitleme LOCK', () => {
  it('iki kopyanın planlı turu aynı işi üretir', () => {
    const t = Date.UTC(2026, 10, 13, 5, 50, 0);
    assert.equal(scheduledInboxSyncJobId('IHBAR', t), scheduledInboxSyncJobId('IHBAR', t + 900));
    assert.notEqual(scheduledInboxSyncJobId('IHBAR', t), scheduledInboxSyncJobId('HASAR', t));
    assert.notEqual(scheduledInboxSyncJobId('IHBAR', t), scheduledInboxSyncJobId('IHBAR', t + 10 * 60_000));
    assert.equal(inboxSyncLockKey('HASAR'), 'inbox-sync-lock:HASAR');
  });

  it('işlem kilidi alır, devam sayfası beklemeye düşer, kilit sahibince bırakılır', () => {
    const p = read('processors/inbound-ingest.processor.ts');
    assert.match(p, /client\.set\(lockKey, lockToken, 'PX', INBOX_SYNC_LOCK_TTL_MS, 'NX'\)/);
    assert.match(p, /if \(nextLink\) \{[\s\S]*?delay: INBOX_SYNC_BUSY_RETRY_MS/);
    assert.match(p, /finally \{[\s\S]*?RELEASE_LOCK_SCRIPT, 1, lockKey, lockToken/);
    assert.match(p, /redis\.call\('get', KEYS\[1\]\) == ARGV\[1\]/);
  });

  it('planlı tur jobId ile tek iş koyar; tamamlanan iş hemen silinmez', () => {
    const s = read('operation-inbox.service.ts');
    assert.match(s, /jobId: scheduledInboxSyncJobId\(mailbox\), removeOnComplete: 50/);
  });

  it('Graph hatası boş mesajla düşmez; eski işaret tanınır', () => {
    const g = read('graph/graph-mail-sync.service.ts');
    assert.match(g, /graphError\?\.message\?\.trim\(\)/);
    assert.match(g, /Graph delta isteği başarısız \(HTTP \$\{res\.status\}\)/);
    assert.doesNotMatch(g, /graphMsg \?\? `Graph delta/);
    assert.match(g, /syncstatenotfound/);
  });
});
