import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { canOpenAcilFinanceAccess } from './acil-finance-access.ts';

const here = dirname(fileURLToPath(import.meta.url));

describe('acil finans arka kapı LOCK', () => {
  it('yalnız yönetici veya Acil vekaletli finans açar', () => {
    assert.equal(canOpenAcilFinanceAccess('admin', false), true);
    assert.equal(canOpenAcilFinanceAccess('finans', true), true);
    assert.equal(canOpenAcilFinanceAccess('finance', true), true);
    assert.equal(canOpenAcilFinanceAccess('accountant', true), true);
  });

  it('ofis, saha, müdür ve vekaletsiz finans düşer', () => {
    assert.equal(canOpenAcilFinanceAccess('office_staff', true), false);
    assert.equal(canOpenAcilFinanceAccess('field_staff', true), false);
    assert.equal(canOpenAcilFinanceAccess('manager', true), false);
    assert.equal(canOpenAcilFinanceAccess('finans', false), false);
    assert.equal(canOpenAcilFinanceAccess('insurance_company_user', true), false);
  });

  it('Acil finans API bekçisi bu kuralı kullanır', () => {
    const guard = readFileSync(
      join(here, '../../../apps/backend/src/modules/emergency/acil-finance-access.guard.ts'),
      'utf8',
    );
    const controller = readFileSync(
      join(here, '../../../apps/backend/src/modules/emergency/emergency-finance.controller.ts'),
      'utf8',
    );
    assert.match(guard, /canOpenAcilFinanceAccess/);
    assert.match(guard, /hasFunctionDelegation\(userId, 'acil_yardim'\)/);
    assert.match(guard, /NotFoundException/);
    assert.match(controller, /AcilFinanceAccessGuard/);
    assert.match(controller, /@UseGuards\(AcilFinanceAccessGuard\)/);
  });
});
