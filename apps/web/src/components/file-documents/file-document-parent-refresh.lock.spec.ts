/**
 * Kilit: onaylı evrak ilk görünce dosya sayfasını yenilemez.
 * Çalıştır: node --experimental-strip-types --test apps/web/src/components/file-documents/file-document-parent-refresh.lock.spec.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const panel = readFileSync(join(here, 'FileDocumentPanel.tsx'), 'utf8');
const acilPage = readFileSync(join(here, '../../app/panel/acil-yardim/[id]/page.tsx'), 'utf8');

describe('file document parent refresh LOCK', () => {
  it('ilk onaylı kayıtta onConditionsMet çağrılmaz', () => {
    assert.match(panel, /seenApprovalStampRef/);
    assert.match(panel, /seenApprovalStampRef\.current === undefined/);
    assert.match(panel, /if \(stamp && stamp !== prev\) onConditionsMet/);
    assert.doesNotMatch(
      panel,
      /if \(activeDoc\.digitallyApprovedAt\) onConditionsMet\?\.\(\)/,
    );
  });

  it('Acil dosya yenilemesi planlayıcıyı sökmez', () => {
    assert.match(acilPage, /vakaRef\.current/);
    assert.match(acilPage, /if \(!vakaRef\.current\) setLoading\(true\)/);
    assert.match(acilPage, /if \(loading && !vaka\)/);
    assert.doesNotMatch(acilPage, /if \(loading\) \{\s*return/);
  });
});
