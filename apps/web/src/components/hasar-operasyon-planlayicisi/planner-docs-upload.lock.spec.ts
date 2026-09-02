/**
 * Kapalı dosyada Evrak Yükleme kırmızı kalmaz.
 * Çalıştır: node --experimental-strip-types --test \
 *   apps/web/src/components/hasar-operasyon-planlayicisi/planner-docs-upload.lock.spec.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));

describe('hasar planner docs_upload lock', () => {
  it('kapanış evrakı yükleme veya dosya kapanışı ile yeşil olur', () => {
    const rules = readFileSync(join(here, 'planner-live-rules.ts'), 'utf8');
    assert.match(rules, /export function plannerDocsUploadDone/);
    assert.match(rules, /Boolean\(flags\.hasDocsUpload\) \|\| Boolean\(flags\.hasFileClosed\)/);
    assert.match(rules, /docs_upload: plannerDocsUploadDone\(flags\)/);
    const snapshot = readFileSync(join(here, 'claim-snapshot.ts'), 'utf8');
    assert.match(snapshot, /hasClosureDocuments/);
    assert.match(snapshot, /hasDocsUploadFromActivity/);
    const steps = readFileSync(join(here, 'steps.tsx'), 'utf8');
    assert.match(steps, /onUploaded=\{\(\) => \{/);
    assert.match(steps, /void refreshClaim\(\)/);
  });
});
