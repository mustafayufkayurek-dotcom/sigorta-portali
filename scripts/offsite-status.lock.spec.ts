/**
 * İkinci yer yedek: gitti sayılmaz ta ki uzak doğrulama bitsin; şifre yazılmaz.
 * Çalıştır: node --experimental-strip-types --test scripts/offsite-status.lock.spec.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));

describe('yedek ikinci yer LOCK', () => {
  it('uzak doğrulama yoksa gitti sayılmaz', () => {
    const offsite = readFileSync(join(here, 'offsite-backup.sh'), 'utf8');
    assert.match(offsite, /RCLONE_REMOTE yok veya rclone yok/);
    assert.match(offsite, /backup-b2-verify\.py/);
    assert.match(offsite, /B2 remote verification veya checksum başarısız/);
    assert.match(offsite, /remoteVerifyOk/);
  });

  it('durum yazısı şifre ve kutu ayarı basmaz', () => {
    const status = readFileSync(join(here, 'offsite-status.sh'), 'utf8');
    assert.match(status, /Şifre ve kutu ayarı burada durmaz/);
    assert.match(status, /lastSuccessAt/);
    assert.match(status, /offsite-backup\.sh/);
    assert.doesNotMatch(status, /cat .*env\.production/);
    assert.doesNotMatch(status, /echo .*RCLONE_REMOTE/);
    assert.doesNotMatch(status, /TELEGRAM_BOT_TOKEN/);
    assert.doesNotMatch(status, /JWT_SECRET/);
  });

  it('24 saati aşınca bekçi haber verir', () => {
    const watch = readFileSync(join(here, 'backup-watchdog.sh'), 'utf8');
    assert.match(watch, /BACKUP_WATCHDOG_WARNING_HOURS:-24/);
    assert.match(watch, /BACKUP_WATCHDOG_CRITICAL_HOURS:-48/);
  });
});
