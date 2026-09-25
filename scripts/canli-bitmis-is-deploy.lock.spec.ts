/**
 * skip-rsync bitmiş iş kilitlerini atlamasın (v583 alımı).
 * Çalıştır: node --experimental-strip-types --test scripts/canli-bitmis-is-deploy.lock.spec.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));

function lockOrder(src: string) {
  const locks = src.indexOf('smoke-canli-bitmis-is.sh');
  const rsync = src.indexOf('rsync -avz');
  assert.ok(locks >= 0, 'deploy bitmiş iş kilit scriptini çağırır');
  assert.ok(rsync >= 0, 'rsync durur');
  assert.ok(locks < rsync, 'kilitler kod kopyasından önce çalışır');
}

describe('canlı bitmiş iş kilit kapısı LOCK', () => {
  it('full ve web alımı skip-rsync ile kilitleri atlamaz', () => {
    lockOrder(readFileSync(join(here, 'deploy-full-production.sh'), 'utf8'));
    lockOrder(readFileSync(join(here, 'deploy-web-production.sh'), 'utf8'));
  });

  it('full alım iki konteyneri birden durdurmaz; JWT ve Redis silinmez', () => {
    const full = readFileSync(join(here, 'deploy-full-production.sh'), 'utf8');
    assert.doesNotMatch(full, /docker stop sigorta-backend sigorta-web/);
    assert.match(full, /eski web ayakta/);
    assert.match(full, /JWT_SECRET/);
    assert.doesNotMatch(full, /redis-cli\s+.*FLUSH/);
    assert.match(full, /exclude '\.env'/);
  });

  it('toplu kilit listesi kendi kapısını doğrular', () => {
    const src = readFileSync(join(here, 'smoke-canli-bitmis-is.sh'), 'utf8');
    assert.match(src, /smoke-acil-netlesen\.sh/);
    assert.match(src, /smoke-liste-gorunum\.sh/);
    assert.match(src, /smoke-panel-auth-gate\.sh/);
    assert.match(src, /smoke-outbound-mail\.sh/);
    assert.match(src, /smoke-finans-kart\.sh/);
    assert.match(src, /pdf-preview-open\.lock\.spec/);
    assert.match(src, /customer-form-identity\.lock\.spec/);
    assert.match(src, /eksper-sigorta-matrix-removed\.lock\.spec/);
    for (const lock of [
      'login-email-code.lock.spec',
      'giris-login-email-code.lock.spec',
      'login-email-code-fill.lock.spec',
      'session-timeout-idle.lock.spec',
      'auth-session-refresh.lock.spec',
      'morning-briefing.lock.spec',
      'site-renewal.lock.spec',
      'disk-watchdog.lock.spec',
      'offsite-status.lock.spec',
      'receipt-scan-human.lock.spec',
      'inbound-classify-human.lock.spec',
      'payment-second-eye.lock.spec',
      'hr-attendance-reminder.lock.spec',
      'hr-activity-beat.lock.spec',
      'panel-activity-heartbeat.lock.spec',
      'acil-saha-atama.lock.spec',
      'approval-72h.lock.spec',
      'acil-vendor-whatsapp.lock.spec',
      'claim-whatsapp-message.lock.spec',
      'invoice-request-list.lock.spec',
      'relationship-type-usage.lock.spec',
      'customer-contacts-merge.lock.spec',
      'hasar-dosya-yukleme.lock.spec',
      'attendance-load-error.lock.spec',
      'ui-action-timeout.lock.spec',
      'panel-table-scroll.lock.spec',
      'panel-cep-duzen.lock.spec',
      'acil-status-transition.lock.spec',
      'document-download-access.lock.spec',
      'acil-finance-access.lock.spec',
      'payment-record-access.lock.spec',
      'hasar-hakedis-once.lock.spec',
      'financial-record-freeze.lock.spec',
      'public-approval-token.lock.spec',
      'panel-native-confirm.lock.spec',
      'personel-test-asama.lock.spec',
      'https-redirect.lock.spec',
    ]) {
      assert.match(src, new RegExp(lock.replace(/\./g, '\\.')));
    }
    const outbound = readFileSync(join(here, 'smoke-outbound-mail.sh'), 'utf8');
    assert.match(outbound, /crm-mail-watch\.lock\.spec/);
    assert.match(outbound, /inbox-reply-quote\.lock\.spec/);
    assert.match(outbound, /inbox-reply-attachment\.lock\.spec/);
    assert.match(outbound, /file-owner-mail-copy\.lock\.spec/);
    const acil = readFileSync(join(here, 'smoke-acil-netlesen.sh'), 'utf8');
    assert.match(acil, /outbound-mail-signal\.lock\.spec/);
    assert.match(acil, /yazisma|inbox-reply-quote/);
    assert.match(acil, /acil-photo-kind\.lock\.spec/);
    const rule = readFileSync(join(here, '../.cursor/rules/bitmis-is-dusmesin.mdc'), 'utf8');
    assert.match(rule, /smoke-canli-bitmis-is\.sh/);
    assert.match(rule, /Düşmesini bekleme/);
  });
});
