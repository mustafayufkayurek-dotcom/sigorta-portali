/**
 * Kapalı Hasar ek onarım kapısı. İlk kapanış durur.
 * Çalıştır: node --experimental-strip-types --test apps/backend/src/modules/finance/hasar-ek-onarim.lock.spec.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));

describe('hasar ek onarım kapısı LOCK', () => {
  it('extra-repair kapısı durur; saha kesilir; closedAt silinmez', () => {
    const ctrl = readFileSync(join(here, 'finance.controller.ts'), 'utf8');
    const src = readFileSync(join(here, 'extra-work-item.service.ts'), 'utf8');
    const link = readFileSync(join(here, 'hasar-extra-repair-link.ts'), 'utf8');
    assert.match(ctrl, /extra-repair/);
    assert.match(ctrl, /reject-repair/);
    assert.match(ctrl, /complete-repair/);
    assert.match(src, /openExtraRepair/);
    assert.match(src, /Saha tespit ek onarım açamaz/);
    assert.match(src, /Ek rapor onaylanmadan ek onarım bitmez/);
    assert.doesNotMatch(src, /closedAt:\s*null/);
    assert.match(link, /linkOpenExtraRepairToReport/);
    assert.match(link, /markExtraRepairApprovedForReport/);
  });
});
