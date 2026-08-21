/**
 * Kilit: Acil planlayıcı önizleme — sekme yok, Kaydet zorunlu kapı, panel tetikleyicisi.
 * Çalıştır: node --experimental-strip-types --test apps/web/src/app/dev/acil-dosya-akis/acil-dosya-akis.lock.spec.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { validateOperatorStep } from './planner-gates.ts';

const here = dirname(fileURLToPath(import.meta.url));
const page = readFileSync(join(here, 'page.tsx'), 'utf8');
const stepsFile = readFileSync(join(here, 'planner-steps.tsx'), 'utf8');

const empty = {
  assigned: null as string | null,
  alis: '',
  satis: '',
  workStartOk: false,
  fileClosed: false,
  financeSent: false,
  approvalState: 'bekliyor' as const,
  approvalText: '',
};

describe('acil dosya akış önizleme LOCK', () => {
  it('operatör 6 sayfa; grup sekmesi yok', () => {
    assert.equal((stepsFile.match(/key: '/g) ?? []).length, 6);
    assert.doesNotMatch(page, /GROUP_TABS/);
    assert.doesNotMatch(page, /PanelPillTabs/);
    assert.doesNotMatch(page, /alt-bolum-sekmeler/);
    assert.doesNotMatch(page, /setActiveGroup/);
  });

  it('sağ panel özet düğmesi ve karelerden açılır', () => {
    assert.match(page, /data-testid="acil-planlayici-ac"/);
    assert.match(page, /setDrawerOpen\(true\)/);
    assert.match(page, /Operasyon Planlayıcısı/);
  });

  it('Kaydet zorunlu kapıyı çalıştırır', () => {
    assert.match(page, /onClick=\{saveCurrentStep\}/);
    assert.match(page, /data-testid="planlayici-kaydet"/);
    assert.equal(validateOperatorStep('tedarikci_saha', empty), 'Tedarikçi atayın.');
    assert.equal(
      validateOperatorStep('maliyet', { ...empty, assigned: 'v1' }),
      'Alış ve satış girin.',
    );
    assert.equal(
      validateOperatorStep('onay', { ...empty, assigned: 'v1', alis: '1', satis: '2', approvalText: 'ok' }),
      'Onayı kaydet veya red verin.',
    );
    assert.equal(
      validateOperatorStep('kapanis', { ...empty, assigned: 'v1', workStartOk: false }),
      'Önce işe başlama işaretlensin.',
    );
    assert.equal(
      validateOperatorStep('finans', { ...empty, fileClosed: false }),
      'Önce dosyayı kapatın.',
    );
    assert.equal(
      validateOperatorStep('finans', {
        ...empty,
        assigned: 'v1',
        alis: '1',
        satis: '2',
        workStartOk: true,
        fileClosed: true,
        financeSent: true,
        approvalState: 'onaylandi',
        approvalText: 'ok',
      }),
      null,
    );
  });

  it('kapanış işe başlamadan açılmaz; finans kapanışsız açılmaz', () => {
    assert.match(stepsFile, /disabled=\{!p.workStartOk\}/);
    assert.match(stepsFile, /disabled=\{!p.fileClosed\}/);
    assert.match(stepsFile, /href="\/panel\/acil-yardim\/finans/);
    assert.match(stepsFile, /acil-hakedis-kayit/);
    assert.match(stepsFile, /Vade uygulanmaz/);
    assert.match(page, /setHakedisAt/);
    assert.match(page, /production.*notFound/);
  });

  it('TL noktalı gösterilir; kâr yüzdesi durur; fotoğraf img ile görünür', () => {
    assert.match(stepsFile, /formatTryAmount/);
    assert.match(stepsFile, /kar-zarar-ozet/);
    assert.match(stepsFile, /<img src=\{ph.url\}/);
    assert.match(page, /<img src=\{ph.url\}/);
    assert.match(page, /createObjectURL/);
    assert.doesNotMatch(stepsFile, /signed-url/);
    assert.match(page, /CallPhone phone=\{FILE.phone\}/);
    assert.match(stepsFile, /CallPhone phone=\{p.file.phone\}/);
    assert.match(stepsFile, /tel:\$\{phone.replace/);
    assert.match(stepsFile, /function AmountField/);
    assert.match(stepsFile, /pr-8/);
    assert.match(stepsFile, />\s*TL/);
  });
});
