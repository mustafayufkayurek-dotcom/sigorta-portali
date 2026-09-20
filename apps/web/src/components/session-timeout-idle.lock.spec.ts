/**
 * Ofiste unutulan ekran: uzun süre dokunulmazsa giriş istenir.
 * Kısa kesinti (5xx) ve lokal deneme oturumu silmez.
 * Çalıştır: node --experimental-strip-types --test apps/web/src/components/session-timeout-idle.lock.spec.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));

describe('unutulan ekran LOCK', () => {
  it('canlıda 30 dakika hareketsizlikte çıkar; Beni Hatırla açık ekranı bırakmaz', () => {
    const bar = readFileSync(join(here, 'SessionTimeoutBar.tsx'), 'utf8');
    assert.match(bar, /SESSION_DURATION_MS = 30 \* 60 \* 1000/);
    assert.match(bar, /LOCAL_SESSION_DURATION_MS = 12 \* 60 \* 60 \* 1000/);
    assert.match(bar, /if \(localDev\) return/);
    assert.doesNotMatch(bar, /if \(rememberMe\) return/);
    assert.match(bar, /if \(localDev \|\| !visible\) return null/);
    assert.doesNotMatch(bar, /if \(rememberMe \|\| localDev \|\| !visible\)/);
  });

  it('kısa sunucu kesintisi oturumu silmez', () => {
    const gate = readFileSync(join(here, '../lib/panel-auth-gate.lock.spec.ts'), 'utf8');
    assert.match(gate, /sunucu kısa kesilince oturum silinmez/);
  });
});
