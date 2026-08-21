/**
 * Kilit: Acil planlayıcı — sekme yok, Kaydet zorunlu kapı, panel tetikleyicisi.
 * Canlı panel + önizleme ortak kaynak.
 * Çalıştır: node --experimental-strip-types --test apps/web/src/app/dev/acil-dosya-akis/acil-dosya-akis.lock.spec.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { validateOperatorStep } from '../../../components/acil-operasyon-planlayicisi/planner-gates.ts';

const here = dirname(fileURLToPath(import.meta.url));
const page = readFileSync(join(here, 'page.tsx'), 'utf8');
const stepsFile = readFileSync(
  join(here, '../../../components/acil-operasyon-planlayicisi/planner-steps.tsx'),
  'utf8',
);
const livePanel = readFileSync(
  join(here, '../../../components/acil-operasyon-planlayicisi/AcilOperasyonPlanlayiciPanel.tsx'),
  'utf8',
);
const livePage = readFileSync(
  join(here, '../../panel/acil-yardim/[id]/page.tsx'),
  'utf8',
);

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
  it('operatör 6 sayfa; grup sekmesi yok (önizleme)', () => {
    assert.equal((stepsFile.match(/key: '/g) ?? []).length, 6);
    assert.doesNotMatch(page, /GROUP_TABS/);
    assert.doesNotMatch(page, /PanelPillTabs/);
    assert.doesNotMatch(page, /alt-bolum-sekmeler/);
    assert.doesNotMatch(page, /setActiveGroup/);
  });

  it('sağ panel özet düğmesi ve karelerden açılır — canlıda da durur', () => {
    assert.match(livePanel, /data-testid="acil-planlayici-ac"/);
    assert.match(livePanel, /setDrawerOpen\(true\)/);
    assert.match(livePanel, /Operasyon Planlayıcısı/);
    assert.match(livePanel, /data-testid="acil-planlayici-cekmece"/);
    assert.match(livePage, /AcilOperasyonPlanlayiciPanel/);
    assert.match(livePage, /acil-saha-tespit/);
  });

  it('Kaydet zorunlu kapıyı çalıştırır', () => {
    assert.match(livePanel, /onClick=\{\(\) => void saveCurrentStep\(\)\}/);
    assert.match(livePanel, /data-testid="planlayici-kaydet"/);
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
    assert.match(stepsFile, /tel:\$\{raw.replace/);
    assert.match(stepsFile, /function AmountField/);
    assert.match(stepsFile, /pr-8/);
    assert.match(stepsFile, />\s*TL/);
  });
});
