/**
 * Personel kadrosu: yalnız Personel Ekle (sicil); test/admin düşmez.
 * Çalıştır: node --experimental-strip-types --test packages/shared/src/hr-personnel-roster.lock.spec.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { isExcludedFromHrRoster } from './hr-personnel-roster.ts';

const here = dirname(fileURLToPath(import.meta.url));

describe('personel kadro LOCK', () => {
  it('test dosya sorumlusu ve yönetici kadroya girmez', () => {
    assert.equal(
      isExcludedFromHrRoster({
        firstName: 'Test Hasar Onarım',
        lastName: 'Dosya Sorumlusu',
        email: 'mustafa.yufkayurek@safranbh.com',
        roleCode: 'office_staff',
      }),
      true,
    );
    assert.equal(
      isExcludedFromHrRoster({
        firstName: 'Sistem',
        lastName: 'Yöneticisi',
        email: 'admin@meridyenassistance.com',
        roleCode: 'admin',
      }),
      true,
    );
  });

  it('İK listesi yalnız sicilli Personel Ekle kaydını gösterir', () => {
    const src = readFileSync(
      join(here, '../../../apps/backend/src/modules/hr/hr.service.ts'),
      'utf8',
    );
    assert.match(src, /personnelNo: \{ not: null \}/);
    assert.match(src, /personnelNo\?\.trim/);
    assert.doesNotMatch(src, /for \(const id of userIds\)/);
    assert.match(src, /belongsOnHrPersonnelRoster/);
  });
});
