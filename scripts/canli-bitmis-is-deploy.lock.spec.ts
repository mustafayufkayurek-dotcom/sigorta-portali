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

  it('toplu kilit listesi kendi kapısını doğrular', () => {
    const src = readFileSync(join(here, 'smoke-canli-bitmis-is.sh'), 'utf8');
    assert.match(src, /smoke-acil-netlesen\.sh/);
    assert.match(src, /smoke-liste-gorunum\.sh/);
    assert.match(src, /smoke-panel-auth-gate\.sh/);
    assert.match(src, /smoke-outbound-mail\.sh/);
    assert.match(src, /skip-rsync/);
  });
});
