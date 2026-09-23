/**
 * Tarayıcı İptal/Tamam kutusu yok; yazılım kendi uyarısını basar.
 * Çalıştır: node --experimental-strip-types --test \
 *   apps/web/src/utils/panel-native-confirm.lock.spec.ts
 */
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SKIP = new Set([
  'panel-native-confirm.lock.spec.ts',
  'sanitize-html.lock.spec.ts',
]);

const NATIVE_CALL =
  /window\.(confirm|alert|prompt)\s*\(|!\s*confirm\s*\(\s*[`'"]/m;

function walk(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === '.next') continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) walk(full, acc);
    else if (/\.(ts|tsx)$/.test(entry.name) && !SKIP.has(entry.name)) acc.push(full);
  }
  return acc;
}

describe('yazılım onay uyarısı LOCK', () => {
  it('tarayıcı confirm/alert kutusu basılmaz', () => {
    const hits: string[] = [];
    for (const file of walk(ROOT)) {
      const src = readFileSync(file, 'utf8');
      if (NATIVE_CALL.test(src)) hits.push(file.slice(ROOT.length + 1));
    }
    assert.deepEqual(hits, []);
  });

  it('personel kalıcı silme yazılım kutusunu kullanır', () => {
    const hr = readFileSync(
      join(ROOT, 'components/hr/AdminAttendanceSupervisionPanel.tsx'),
      'utf8',
    );
    assert.match(hr, /usePanelConfirm/);
    assert.match(hr, /kalıcı silinsin mi/);
    assert.doesNotMatch(hr, /window\.confirm/);
  });
});
