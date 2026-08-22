/**
 * Kilit: Acil finans sayfası yalnız admin + Acil vekaletli finans.
 * Çalıştır: node --experimental-strip-types --test apps/web/src/utils/acil-finance-page-access.lock.spec.ts
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const access = readFileSync(join(here, 'panel-access.ts'), 'utf8');
const hook = readFileSync(join(here, '../hooks/usePanelAccess.ts'), 'utf8');
const steps = readFileSync(
  join(here, '../components/acil-operasyon-planlayicisi/planner-steps.tsx'),
  'utf8',
);
const live = readFileSync(join(here, '../app/panel/acil-yardim/[id]/page.tsx'), 'utf8');

describe('acil finans sayfası erişim LOCK', () => {
  it('kapı: admin veya Acil vekaletli finans; ofis/dosya sorumlusu yok', () => {
    assert.match(access, /export function canOpenAcilFinancePage/);
    assert.match(access, /role === 'admin'/);
    assert.match(
      access,
      /isFinanceRole\(role\) && hasActiveFunctionDelegation\(operationalAccessGrants, 'acil_yardim'\)/,
    );
    const fn = access.slice(access.indexOf('export function canOpenAcilFinancePage'));
    const body = fn.slice(0, fn.indexOf('export function canAccessAcilYardim'));
    assert.doesNotMatch(body, /office_staff/);
    assert.doesNotMatch(body, /role === 'manager'/);
  });

  it('acil finans URL’si dosya sorumlusuna açılmaz', () => {
    const route = access.slice(access.indexOf('export function canAccessAcilYardimRoute'));
    const head = route.slice(0, route.indexOf('export function hasPanelRouteAccess'));
    assert.match(head, /isAcilYardimFinansPath\(pathname\)/);
    assert.match(head, /return canOpenAcilFinancePage/);
    const finansFirst = head.indexOf('isAcilYardimFinansPath');
    const acilAll = head.indexOf('canAccessAcilYardim(');
    assert.ok(finansFirst >= 0 && acilAll > finansFirst);
  });

  it('düğme ve canlı dosya kapıya bağlıdır', () => {
    assert.match(hook, /showAcilFinancePage: canOpenAcilFinancePage/);
    assert.match(steps, /p\.canOpenFinancePage/);
    assert.match(steps, /acil-finans-sayfasini-ac/);
    assert.match(live, /canOpenFinancePage: showAcilFinancePage/);
    assert.match(live, /usePanelAccess/);
  });
});
