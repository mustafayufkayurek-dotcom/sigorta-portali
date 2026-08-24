/**
 * Kilit: Acil sunum özeti boşlukları yutmaz.
 * Çalıştır: node --experimental-strip-types --test apps/web/src/components/acil-operasyon-planlayicisi/planner-gates.lock.spec.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  acilOnayMetinGovde,
  withAcilOnayMetinOnEk,
} from './planner-gates.ts';

const here = dirname(fileURLToPath(import.meta.url));
const steps = readFileSync(join(here, 'planner-steps.tsx'), 'utf8');
const gates = readFileSync(join(here, 'planner-gates.ts'), 'utf8');

describe('acil sunum özeti boşluk LOCK', () => {
  it('yazarken kelime sonu boşluğu silinmez', () => {
    const next = withAcilOnayMetinOnEk('Riziko adreste; kilit ');
    assert.equal(next, 'Riziko adreste; kilit ');
    assert.equal(acilOnayMetinGovde(next), 'kilit ');
  });

  it('cümledeki boşluklar durur', () => {
    const text = withAcilOnayMetinOnEk('Riziko adreste; kilit değişimi yapılmadı');
    assert.equal(text, 'Riziko adreste; kilit değişimi yapılmadı');
    assert.equal(acilOnayMetinGovde(text), 'kilit değişimi yapılmadı');
    assert.doesNotMatch(text, /kilitdeğişimiyapılmadı/);
  });

  it('onChange gövdeyi trim etmez; doğrulama trim kullanır', () => {
    const govdeFn = gates.slice(
      gates.indexOf('export function acilOnayMetinGovde'),
      gates.indexOf('export function withAcilOnayMetinOnEk'),
    );
    const wrapFn = gates.slice(
      gates.indexOf('export function withAcilOnayMetinOnEk'),
      gates.indexOf('export function validateOperatorStep'),
    );
    assert.doesNotMatch(govdeFn, /\.trim\(/);
    assert.doesNotMatch(wrapFn, /\.trim\(/);
    assert.doesNotMatch(wrapFn, /body \? `/);
    assert.doesNotMatch(gates, /\.trim\(\)\.replace\(\/\^Riziko adreste/);
    assert.match(gates, /acilOnayMetinGovde\(s\.approvalText\)\.trim\(\)/);
    assert.match(steps, /onChange=\{\(e\) => p\.onApprovalText\(withAcilOnayMetinOnEk\(e\.target\.value\)\)\}/);
    assert.match(steps, /acilOnayMetinGovde\(p\.approvalText\)\.trim\(\)/);
  });
});
