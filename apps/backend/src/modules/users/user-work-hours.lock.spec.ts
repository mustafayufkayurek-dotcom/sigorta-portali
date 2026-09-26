/**
 * Mesai kapısı kişi yazımı.
 * Çalıştır: node --experimental-strip-types --test apps/backend/src/modules/users/user-work-hours.lock.spec.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));

describe('kullanıcı mesai kapısı yazımı LOCK', () => {
  it('skaler alana yazılır ve portal kaydına düşmez', () => {
    const fields = readFileSync(join(here, 'user-update-fields.ts'), 'utf8');
    assert.match(fields, /workHoursRestricted/);
    const service = readFileSync(join(here, 'users.service.ts'), 'utf8');
    assert.match(service, /applyWorkHoursRestrictedWrite/);
    assert.match(service, /isMeridyenStaffRole/);
    assert.match(service, /delete rest\.workHoursRestricted/);
    const hr = readFileSync(join(here, '../hr/hr.service.ts'), 'utf8');
    assert.match(hr, /workHoursGateApplies/);
    assert.match(hr, /workHoursRestricted/);
  });
});
