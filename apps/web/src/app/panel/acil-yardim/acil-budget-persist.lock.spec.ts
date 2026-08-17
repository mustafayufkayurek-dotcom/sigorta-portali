/**
 * Acil bütçe persist kilidi — Kaydet yalnızca localStorage’a yazmasın.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';

const page = readFileSync(
  join(__dirname, '[id]', 'page.tsx'),
  'utf8',
);

describe('acil-budget-persist LOCK', () => {
  it('savePriceForm upsertBudgetCostEntries çağırır', () => {
    assert.match(page, /async function savePriceForm/);
    assert.match(page, /upsertBudgetCostEntries/);
    const saveStart = page.indexOf('async function savePriceForm');
    const saveBody = page.slice(saveStart, saveStart + 3500);
    assert.match(saveBody, /upsertBudgetCostEntries/);
  });

  it('load resolveAcilBudgetAmounts ile hydrate eder', () => {
    assert.match(page, /resolveAcilBudgetAmounts/);
    const loadStart = page.indexOf('const load = useCallback');
    const loadBody = page.slice(loadStart, loadStart + 2000);
    assert.match(loadBody, /resolveAcilBudgetAmounts/);
  });
});
