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
  validateOperatorDraftSave,
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

  it('Tedarikçi adımında Atanan Tedarikçi saha ile karışmaz', () => {
    assert.match(steps, /Atanan Tedarikçi/);
    assert.doesNotMatch(steps, /<Card title="Atanan">/);
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
    const withoutDelete = page.replace(
      /async function handleDeleteAssistanceReport[\s\S]*?setActionFlash\('Rapor silindi[\s\S]*?\n  \}/,
      '',
    );
    assert.doesNotMatch(withoutDelete, /idChanged \? '' : draftFindingsRef/);
    assert.doesNotMatch(withoutDelete, /draftFindingsRef\.current = ''/);
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

  it('Kaydet raporu taslak tutar; İncele resim istemez', () => {
    const base = {
      assigned: 'v1',
      alis: '100',
      satis: '200',
      workStartOk: true,
      fileClosed: false,
      financeSent: false,
      approvalState: 'bekliyor' as const,
      approvalText: '',
      isLocksmith: false,
      findingsText: 'Riziko adreste; cam kırık',
      reportWorkGroup: 'duvar işleri',
      reportMahal: 'salon',
      reportJobDescription: 'lamine cam yenileme',
      reportItemDescription: 'çerçeve sağlam, cam kırık',
      photoCount: 0,
      approvalRequested: false,
    };
    assert.equal(validateOperatorDraftSave('onay', base), null);
  });

  it('Çilingir Onayı Kaydet durur; diğerlerinde rapor gönderilir', () => {
    assert.match(steps, />Onayı Kaydet</);
    assert.match(steps, />Manuel Onay Ver</);
    assert.match(steps, /Revize Et/);
    assert.match(steps, /Raporu Sil/);
    assert.doesNotMatch(steps, /Elle Onay/);
    assert.match(steps, /Müşteri Onayına Gönder/);
    assert.doesNotMatch(steps, /Raporu Asistansa Gönder/);
    assert.match(steps, /Raporu İncele/);
    assert.match(steps, /acil-raporu-incele/);
    assert.match(steps, /Önce tespit bulgusunu yazın/);
    assert.match(gates, /Mahal\/Bölge Yazın/);
    assert.match(steps, /Önce iş grubu, mahal, işin tanımı ve açıklamayı yazın/);
    assert.match(gates, /isLocksmith === false/);
    assert.match(gates, /validateOperatorDraftSave/);
    assert.match(steps, /reportWritten/);
    assert.match(steps, /Göndermek için tespit resmi ekleyin/);
    assert.doesNotMatch(steps, /disabled=\{p\.openingApprovalReport \|\| !reportWritten\}/);
    assert.match(steps, /disabled=\{p\.openingApprovalReport\}/);
    const panel = readFileSync(join(here, 'AcilOperasyonPlanlayiciPanel.tsx'), 'utf8');
    assert.match(panel, /validateOperatorDraftSave/);
    assert.match(panel, /writeAcilPlannerUi/);
    assert.match(panel, /readAcilPlannerUi/);
    const onayMount = panel.slice(panel.indexOf("activeStep === 'onay'"), panel.indexOf("activeStep === 'kapanis'"));
    assert.ok(onayMount.indexOf('{approvalStep}') < onayMount.indexOf('<PlannerStepBody'));
  });
});
