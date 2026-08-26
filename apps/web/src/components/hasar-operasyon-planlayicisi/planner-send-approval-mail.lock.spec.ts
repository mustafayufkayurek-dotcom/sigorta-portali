/**
 * Kilit: Planlayıcı onaya gönder = dış onay. Taslak PDF yedek yolu yok.
 * Çalıştır: node --experimental-strip-types --test apps/web/src/components/hasar-operasyon-planlayicisi/planner-send-approval-mail.lock.spec.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const specDir = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(join(specDir, 'planner-send-approval-mail.ts'), 'utf8');

describe('planlayıcı onay maili LOCK', () => {
  it('yalnız send-external-approval çağırır', () => {
    assert.match(src, /send-external-approval/);
    assert.doesNotMatch(
      src,
      /send-email/,
      'Taslak PDF yedek yolu (send-email) onaya gönderimde yasak',
    );
  });
});
