/**
 * Disk daralınca önce güvenli temizlik. Haber, temizlik yetmezse gider.
 * Uploads silinmez.
 * Çalıştır: node --experimental-strip-types --test scripts/disk-watchdog.lock.spec.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));

describe('disk bekçisi LOCK', () => {
  it('daralınca önce güvenli bakım çalışır; uploads silinmez', () => {
    const script = readFileSync(join(here, 'disk-watchdog.sh'), 'utf8');
    assert.match(script, /DISK_WATCHDOG_CRITICAL_GB:-5/);
    assert.match(script, /DISK_WATCHDOG_WARNING_GB:-8/);
    assert.match(script, /server-disk-maintenance\.sh/);
    assert.match(script, /TARGET_FREE_GB="\$WARN_GB"/);
    assert.match(script, /disk-watchdog\.state/);
    assert.match(script, /disk-watchdog\.hold/);
    const full = readFileSync(join(here, 'deploy-full-production.sh'), 'utf8');
    assert.match(full, /disk-watchdog\.hold/);
    assert.match(script, /telegram-notify\.sh/);
    assert.match(script, /DISK_FULL/);
    assert.match(script, /Uploads silinmez/);
    assert.match(script, /Sizin işleminiz gerekmez/);
    const maintAt = script.indexOf('server-disk-maintenance.sh');
    const critAt = script.indexOf('DISK_FULL');
    assert.ok(maintAt > 0 && critAt > maintAt);
    assert.doesNotMatch(script, /rm -rf/);
    assert.doesNotMatch(script, /uploads\/\*\.tar\.gz/);
    assert.doesNotMatch(script, /^\s*docker\s/m);
    assert.doesNotMatch(script, /scripts\/server-disk-maintenance\.sh ile/);
    const alarm = readFileSync(join(here, 'disk-alarm.sh'), 'utf8');
    assert.match(alarm, /exec "\$ROOT\/disk-watchdog\.sh"/);
    assert.doesNotMatch(alarm, /temizlenmeli/);
  });

  it('bakım hedef boş alanı bilir; çalışan image silinmez', () => {
    const maint = readFileSync(join(here, 'server-disk-maintenance.sh'), 'utf8');
    assert.match(maint, /TARGET_FREE_GB="\$\{TARGET_FREE_GB:-\$MIN_FREE_GB\}"/);
    assert.match(maint, /ASLA: docker image prune -af/);
    assert.doesNotMatch(maint, /^\s*docker image prune -af/m);
    assert.match(maint, /uploads arşivlerine ve canlı uploads/);
  });

  it('alım kapısı 5 GB ile aynı eşiği kullanır', () => {
    const script = readFileSync(join(here, 'disk-watchdog.sh'), 'utf8');
    const deploy = readFileSync(join(here, 'deploy-full-production.sh'), 'utf8');
    assert.match(deploy, /minimum 5 GB/);
    assert.match(script, /df -k \//);
    assert.match(deploy, /server-disk-maintenance\.sh/);
  });
});
