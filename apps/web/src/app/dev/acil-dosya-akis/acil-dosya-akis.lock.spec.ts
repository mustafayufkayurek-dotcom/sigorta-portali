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
  it('operatör 5 sayfa; grup sekmesi yok (önizleme)', () => {
    assert.equal((stepsFile.match(/key: '/g) ?? []).length, 5);
    assert.doesNotMatch(page, /GROUP_TABS/);
    assert.doesNotMatch(page, /PanelPillTabs/);
    assert.doesNotMatch(page, /alt-bolum-sekmeler/);
    assert.doesNotMatch(page, /setActiveGroup/);
  });

  it('sağ panel özet düğmesi ve karelerden açılır — canlıda da durur', () => {
    assert.match(livePanel, /data-testid="acil-planlayici-ac"/);
    assert.match(livePanel, /setDrawerOpen\(true\)/);
    assert.match(livePanel, /Operasyonu Başlat/);
    assert.match(livePanel, /data-testid="acil-planlayici-cekmece"/);
    assert.match(livePage, /AcilOperasyonPlanlayiciPanel/);
    assert.match(livePage, /acil-saha-tespit/);
    assert.match(livePage, /operatorStepStatuses/);
    assert.doesNotMatch(livePage, /guncel-alis-satis-gir/);
    assert.doesNotMatch(livePage, /AcilHeaderStageStrip/);
    assert.doesNotMatch(livePage, /operasyon-iki-kolon/);
    assert.doesNotMatch(livePage, /Süreci Aç/);
    assert.match(livePanel, /STEP_ICONS/);
    assert.match(livePanel, /PhoneCall/);
    assert.match(livePanel, /BadgeCheck/);
    assert.match(livePanel, /Landmark/);
    assert.match(livePanel, /acil-siradaki-is/);
    assert.match(livePanel, /acil-siradaki-pulse/);
    assert.match(livePanel, /data-next=/);
    assert.match(livePanel, /stepResultLine/);
    assert.doesNotMatch(livePanel, /acil-ozet-yan-pencereler/);
    assert.doesNotMatch(livePanel, /Süreç ilerlemesi/);
    assert.doesNotMatch(livePanel, /Dosya durumu/);
    assert.doesNotMatch(livePanel, /Dosyada Kimler Var/);
    assert.doesNotMatch(livePanel, /Operasyon Planlama Özeti/);
    assert.match(stepsFile, /acil-ihbar-tarihi/);
    assert.match(stepsFile, /Mailin geldiği tarih ve saat/);
    assert.match(stepsFile, /acil-hizmet-verildi/);
    assert.match(livePage, /applyAcilCaseTimestamps/);
    assert.match(livePage, /acil-islem-saatleri/);
    assert.match(livePage, /ihbarDate: ihbarRozet/);
    assert.match(livePage, /onServiceComplete/);
    assert.match(livePage, /hour: '2-digit'/);
    assert.match(livePage, /lastReceivedAt/);
    assert.match(livePage, /fillHeight=\{false\}/);
    assert.match(livePage, /handlePlannerWorkStart/);
    assert.match(livePage, /assignedVendorId/);
    assert.match(livePanel, /acil-once-tedarikci/);
    assert.match(livePanel, /Önce tedarikçiyi atayın/);
    assert.doesNotMatch(stepsFile, /WaBtn[\s\S]{0,400}Önce tedarikçi atayın/);
  });

  it('Kaydet zorunlu kapıyı çalıştırır', () => {
    assert.match(livePanel, /onClick=\{\(\) => void saveCurrentStep\(\)\}/);
    assert.match(livePanel, /data-testid="planlayici-kaydet"/);
    assert.equal(validateOperatorStep('tedarikci_maliyet', empty), 'Tedarikçi atayın.');
    assert.equal(
      validateOperatorStep('tedarikci_maliyet', { ...empty, assigned: 'v1' }),
      'Alış ve satış girin.',
    );
    assert.equal(
      validateOperatorStep('onay', { ...empty, assigned: 'v1', alis: '1', satis: '2', approvalText: 'Riziko adreste; asansör' }),
      'Onayı kaydet veya red verin.',
    );
    assert.equal(
      validateOperatorStep('onay', { ...empty, assigned: 'v1', alis: '1', satis: '2', approvalText: 'Riziko adreste;' }),
      'Riziko adreste açıklamasını yazın.',
    );
    assert.equal(
      validateOperatorStep('kapanis', { ...empty, assigned: 'v1', approvalState: 'bekliyor' }),
      'Önce onay talep akışı tamamlansın.',
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
      'Tedarikçi ödemesini ödendi veya ödenmedi olarak onaylayın.',
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
        vendorPaid: false,
      }),
      null,
    );
  });

  it('kapanış işe başlamadan açılmaz; finans kapanışsız açılmaz', () => {
    assert.match(stepsFile, /disabled=\{p.approvalState !== 'onaylandi'\}/);
    assert.match(stepsFile, /disabled=\{!p.fileClosed \|\|/);
    assert.match(stepsFile, /canOpenFinancePage/);
    assert.match(stepsFile, /acil-finans-sayfasini-ac/);
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
    assert.match(stepsFile, /minimumFractionDigits: 2/);
    assert.match(stepsFile, /WhatsAppIcon/);
    assert.match(stepsFile, /Dosya bilgilerini gönder/);
    assert.match(stepsFile, /vendorWhatsAppText/);
    assert.match(stepsFile, /Onay Talep Akışı/);
    assert.match(stepsFile, /acil-finans-kdv/);
    assert.match(stepsFile, /STANDARD_VAT_RATE/);
    assert.match(stepsFile, /calcVatBreakdown/);
    assert.match(stepsFile, /KDV \(%\{STANDARD_VAT_RATE\}\)/);
    assert.match(stepsFile, /pr-8/);
    assert.match(stepsFile, />\s*TL/);
  });
});
