/**
 * Backend kaynağı src dışından içe aktarım yapmaz; yoksa çıktı dist/src/main olur ve konteyner açılmaz.
 * Çalıştır: node --experimental-strip-types --test apps/backend/src/common/backend-build-root.lock.spec.ts
 */
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, resolve, sep } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const srcRoot = join(dirname(fileURLToPath(import.meta.url)), '..');

function tsFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) return tsFiles(full);
    return full.endsWith('.ts') && !full.endsWith('.spec.ts') ? [full] : [];
  });
}

describe('backend derleme kökü LOCK', () => {
  it('src dosyaları src dışını içe aktarmaz', () => {
    const offenders = tsFiles(srcRoot).flatMap((file) =>
      [...readFileSync(file, 'utf8').matchAll(/from\s+['"](\.{1,2}\/[^'"]+)['"]/g)]
        .map((m) => resolve(dirname(file), m[1]))
        .filter((target) => !target.startsWith(srcRoot + sep))
        .map((target) => `${file} -> ${target}`),
    );
    assert.deepEqual(offenders, []);
  });
});
