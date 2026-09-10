/**
 * Yönetici oturumunda Dosya Takip kapısı Çıkış Yap gösterir.
 * Çalıştır: node --experimental-strip-types --test apps/web/src/app/panel/asistans-portal/_components/asistans-portal-role-gate.lock.spec.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const gate = readFileSync(join(here, 'AsistansPortalRoleGate.tsx'), 'utf8');
const page = readFileSync(join(here, '../page.tsx'), 'utf8');

describe('asistans portal rol kapısı LOCK', () => {
  it('yöneticiye çıkış verir; hatırlanan e-postayı siler', () => {
    assert.match(gate, /Çıkış Yap/);
    assert.match(gate, /yönetici oturumundasınız/);
    assert.match(gate, /forceForgetEmail: true/);
    assert.match(page, /AsistansPortalRoleGate/);
  });
});
