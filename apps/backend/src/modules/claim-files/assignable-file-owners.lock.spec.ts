/**
 * Finans personeli acil dosya sorumlusu vekaleti alınca listede görünür.
 * Çalıştır: node --experimental-strip-types --test apps/backend/src/modules/claim-files/assignable-file-owners.lock.spec.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { mergeAssignableStaffWithDelegates } from './assignable-file-owners.ts';

const here = dirname(fileURLToPath(import.meta.url));

describe('acil dosya sorumlusu listesi LOCK', () => {
  it('finans vekili ofis listesine eklenir; tekrarlanmaz', () => {
    const merged = mergeAssignableStaffWithDelegates(
      [{ id: 'o1', firstName: 'Ayşe', lastName: 'Ofis' }],
      [
        { id: 'f1', firstName: 'Mehmet', lastName: 'Finans' },
        { id: 'o1', firstName: 'Ayşe', lastName: 'Ofis' },
      ],
    );
    assert.equal(merged.length, 2);
    assert.deepEqual(
      merged.map((p) => p.id).sort(),
      ['f1', 'o1'],
    );
  });

  it('acil yeni dosya formu vekalet parametresi ister', () => {
    const form = readFileSync(
      join(here, '../../../../web/src/components/emergency/EmergencyCaseNewForm.tsx'),
      'utf8',
    );
    assert.match(form, /includeDelegates:\s*'acil_yardim'/);
    assert.match(form, /claim-files\/assignable-staff/);
  });

  it('API ofis personeline acil fonksiyon vekillerini katar', () => {
    const service = readFileSync(join(here, 'claim-files.service.ts'), 'utf8');
    const controller = readFileSync(join(here, 'claim-files.controller.ts'), 'utf8');
    assert.match(service, /mergeAssignableStaffWithDelegates/);
    assert.match(service, /listActiveFunctionDelegates/);
    assert.match(controller, /includeDelegates/);
  });
});
