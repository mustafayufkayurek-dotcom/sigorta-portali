/**
 * Onarım raporu teslim maili — teal kart, operasyon mavisi yok.
 * Çalıştır: node --experimental-strip-types --test apps/backend/src/modules/repair-reports/email/report-dispatch-email.lock.spec.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(join(here, 'report-dispatch-email.template.ts'), 'utf8');
const service = readFileSync(join(here, 'report-email.service.ts'), 'utf8');

describe('onarım raporu teslim maili LOCK', () => {
  it('referans kart + teal; düz cümle ve operasyon mavisi yok', () => {
    assert.match(src, /Rapor Bildirimi/);
    assert.match(src, /Hasar Onarım Raporu/);
    assert.match(src, /Dış kullanım PDF/);
    assert.match(src, /#0F766E/);
    assert.match(src, /Dosyayı Görüntüle/);
    assert.doesNotMatch(src, /#1E5AA8/);
    assert.doesNotMatch(src, /#C2410C/);
    assert.doesNotMatch(src, /Operasyon Bildirimi/);
    assert.match(service, /buildReportDispatchEmailHtml/);
    assert.doesNotMatch(service, /Hasar Onarım Raporu \(\$\{opts\.reportNo\}\) ektedir/);
  });
});
