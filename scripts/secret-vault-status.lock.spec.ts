import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));

describe('felaket kasası LOCK', () => {
  it('durum yazısı şifre ve kutu ayarı basmaz', () => {
    const src = readFileSync(join(here, 'secret-vault-status.sh'), 'utf8');
    assert.match(src, /Felaket kasası/);
    assert.match(src, /kilitli kutu/);
    assert.doesNotMatch(src, /POSTGRES_PASSWORD/);
    assert.doesNotMatch(src, /JWT_SECRET/);
    assert.doesNotMatch(src, /\.env\.production/);
    assert.doesNotMatch(src, /rclone\.conf/);
  });
});
