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
  resolveAcilApprovalText,
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
    assert.match(gates, /Servis Onay Formu Dijital Onayı Olmadan/);
    assert.match(steps, /onChange=\{\(e\) => p\.onApprovalText\(withAcilOnayMetinOnEk\(e\.target\.value\)\)\}/);
    assert.match(steps, /acilOnayMetinGovde\(p\.approvalText\)\.trim\(\)/);
  });

  it('Acil tedarikçi sözleşmesi hizmet alımıdır', () => {
    assert.match(steps, /AcilVendorServiceContractPanel/);
    assert.doesNotMatch(steps, /Tedarikçi Onarım Sözleşmesi/);
  });

  it('Riziko adreste sunum kutusunda tekrarlanmaz', () => {
    assert.match(steps, /Sunum Özeti/);
    assert.match(steps, /acil-onay-metin/);
    assert.doesNotMatch(steps, /Sunum Özeti[\s\S]{0,500}\{p\.approvalText\}/);
  });

  it('bütçe kutusunda dosya konusu durur', () => {
    assert.match(steps, /acil-butce-dosya-konusu/);
    assert.match(steps, /Dosya Konusu/);
    assert.match(steps, /Bu Dosyanın Bütçesi/);
    assert.match(steps, /p\.file\.subject/);
  });

  it('tespit yazısı adım değişince ve yenilemede kaybolmaz', () => {
    const page = readFileSync(
      join(here, '../../app/panel/acil-yardim/[id]/page.tsx'),
      'utf8',
    );
    const panel = readFileSync(join(here, 'AcilOperasyonPlanlayiciPanel.tsx'), 'utf8');
    const workflow = readFileSync(
      join(here, '../../app/panel/acil-yardim/[id]/acil-workflow.ts'),
      'utf8',
    );
    assert.match(page, /draftFindingsRef/);
    assert.match(page, /onNavigateStep/);
    assert.match(panel, /onNavigateStep\?\./);
    assert.match(page, /resolveEmergencyFindingsDraft/);
    assert.match(page, /persistPlannerDrafts/);
    assert.match(page, /resolveAcilApprovalText/);
    assert.doesNotMatch(page, /idChanged \? '' : draftFindingsRef/);
    assert.doesNotMatch(page, /draftFindingsRef\.current = ''/);
    assert.match(workflow, /findingsDraft/);
    assert.match(workflow, /approvalText/);
    assert.match(workflow, /stampAcilLocalDrafts/);
    assert.equal(
      resolveAcilApprovalText('', 'Riziko adreste; kilit değişimi yapılmadı'),
      'Riziko adreste; kilit değişimi yapılmadı',
    );
    assert.equal(
      resolveAcilApprovalText('Riziko adreste; yazılan ', ''),
      'Riziko adreste; yazılan ',
    );
  });
});
