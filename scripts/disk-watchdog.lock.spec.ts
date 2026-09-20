/**
 * Disk dolunca yazılım susmaz: bekçi uyarır, uploads silinmez.
 * Çalıştır: node --experimental-strip-types --test scripts/disk-watchdog.lock.spec.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));

describe('disk bekçisi LOCK', () => {
  it('yalnız uyarır; canlı uploads ve yedek silinmez', () => {
    const script = readFileSync(join(here, 'disk-watchdog.sh'), 'utf8');
    assert.match(script, /DISK_WATCHDOG_CRITICAL_GB:-5/);
    assert.match(script, /DISK_WATCHDOG_WARNING_GB:-8/);
    assert.match(script, /telegram-notify\.sh/);
    assert.match(script, /DISK_FULL/);
    assert.match(script, /Uploads silinmez/);
    assert.doesNotMatch(script, /rm -rf/);
    assert.doesNotMatch(script, /uploads\/\*\.tar\.gz/);
    assert.doesNotMatch(script, /docker.*prune/);
  });

  it('alım kapısı 5 GB ile aynı eşiği kullanır', () => {
    const script = readFileSync(join(here, 'disk-watchdog.sh'), 'utf8');
    const deploy = readFileSync(join(here, 'deploy-full-production.sh'), 'utf8');
    assert.match(deploy, /minimum 5 GB/);
    assert.match(script, /df -k \//);
    assert.match(deploy, /server-disk-maintenance\.sh/);
  });
});
