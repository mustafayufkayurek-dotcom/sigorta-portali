/**
 * Onarım kalemi tutarı — 1.850.000 binlik durur, 1,85 olmaz.
 * Çalıştır: node --experimental-strip-types --test apps/web/src/utils/repair-report-number-input.lock.spec.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  evaluateAmountExpression,
  formulaForEval,
  normalizeCellNumericInput,
  parseTrAmountInput,
  parseTrGroupedOrDecimal,
} from './tr-amount-input.ts';

const dir = dirname(fileURLToPath(import.meta.url));
const page = readFileSync(
  join(dir, '../app/panel/hasar-dosyalari/[id]/onarim-raporu/[reportId]/page.tsx'),
  'utf8',
);

describe('onarım büyük tutar kilidi', () => {
  it('1.850.000 satış ve maliyette bir milyon sekiz yüz elli bindir', () => {
    assert.equal(parseTrAmountInput('1.850.000'), 1_850_000);
    assert.equal(parseTrGroupedOrDecimal('1.850.000'), 1_850_000);
    assert.equal(normalizeCellNumericInput('1.850.000'), '1850000');
    assert.equal(evaluateAmountExpression('1.850.000'), null);
    assert.equal(evaluateAmountExpression(formulaForEval('1.850.000')), null);
  });

  it('ondalık virgül ve hesap ayrı durur', () => {
    assert.equal(parseTrAmountInput('1,85'), 1.85);
    assert.equal(parseTrGroupedOrDecimal('1,85'), 1.85);
    assert.equal(parseTrGroupedOrDecimal('1.85'), 1.85);
    assert.equal(parseTrGroupedOrDecimal('15.600'), 15600);
    assert.equal(evaluateAmountExpression(formulaForEval('1.850.000+150')), 1_850_150);
    assert.equal(evaluateAmountExpression(formulaForEval('15.600*2')), 31200);
    assert.equal(evaluateAmountExpression(formulaForEval('1,85+2')), 3.85);
  });

  it('satış maliyet kutusu önce binlik tutarı okur; hesap ikinci', () => {
    const commit = page.slice(page.indexOf('const commit = (raw: string)'), page.indexOf('const commitShadow'));
    assert.match(commit, /if \(amountFormat && !looksLikeCalcFormula\(raw\)\)/);
    assert.match(commit, /parseTrAmountInput\(raw\)/);
    const amountFirst = commit.indexOf('amountFormat && !looksLikeCalcFormula');
    const evalLater = commit.indexOf('evaluateAmountExpression');
    assert.ok(amountFirst >= 0 && evalLater > amountFirst);
  });
});
