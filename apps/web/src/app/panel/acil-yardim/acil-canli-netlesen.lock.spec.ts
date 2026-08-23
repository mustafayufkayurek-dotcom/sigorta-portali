/**
 * Kilit: Canlıya alınan Acil netleşen iş — adres, telefon, TL, foto, hakediş vadesiz.
 * Çalıştır: node --experimental-strip-types --test apps/web/src/app/panel/acil-yardim/acil-canli-netlesen.lock.spec.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const acilPage = readFileSync(join(here, '[id]/page.tsx'), 'utf8');
const finans = readFileSync(join(here, 'finans/page.tsx'), 'utf8');
const photos = readFileSync(
  join(here, '../../../components/field-survey/FieldInspectionPhotosPanel.tsx'),
  'utf8',
);
const grant = readFileSync(
  join(here, '../../../../../../apps/backend/src/modules/emergency/acil-vendor-entitlement.ts'),
  'utf8',
);
const financeSvc = readFileSync(
  join(here, '../../../../../../apps/backend/src/modules/emergency/emergency-finance.service.ts'),
  'utf8',
);
const preview = readFileSync(
  join(here, '../../dev/acil-dosya-akis/page.tsx'),
  'utf8',
);
const musteriGorunum = readFileSync(
  join(here, '../../dev/acil-musteri-gorunum/page.tsx'),
  'utf8',
);

describe('acil canlı netleşen LOCK', () => {
  it('canlı dosyada adres formatter, aranır telefon, alış/satış TL', () => {
    assert.match(acilPage, /formatEmergencyFileAddress/);
    assert.match(acilPage, /PhoneContactActions/);
    assert.match(acilPage, /data-testid="alis-fiyati"/);
    assert.match(acilPage, /absolute right-2\.5[\s\S]*TL/);
    assert.match(acilPage, /Vade uygulanmaz/);
    assert.match(acilPage, /acil-hakedis-ilk-kullanim-seridi/);
    assert.match(acilPage, /OPS_NOTICE\.acilTedarikciHakedis/);
    assert.match(acilPage, /OPS_NOTICE\.acilDosyaSonDegisiklik/);
    assert.match(acilPage, /acil-dosya-ilk-kullanim-seridi/);
    assert.match(acilPage, /AcilOperasyonPlanlayiciPanel/);
    assert.match(acilPage, /acil-saha-tespit/);
    assert.match(acilPage, /FieldInspectionPhotosPanel/);
    assert.match(acilPage, /tespit-bulgulari-input/);
    assert.match(acilPage, /vendorStep/);
    assert.match(acilPage, /approvalStep/);
    assert.match(acilPage, /acil-onay-evrak/);
    assert.match(acilPage, /fillHeight=\{false\}/);
    assert.match(acilPage, /acil-islem-saatleri/);
    assert.match(acilPage, /applyAcilCaseTimestamps/);
    assert.match(acilPage, /handleServiceComplete/);
    assert.match(acilPage, /autoClosureEmail/);
    assert.match(acilPage, /handleSendToFinance/);
    assert.match(acilPage, /acil-konum-tespit/);
    assert.match(acilPage, /LocationPickerModal/);
    assert.match(acilPage, /vendorWhatsAppText/);
    const workflow = readFileSync(join(here, '[id]/acil-workflow.ts'), 'utf8');
    assert.match(workflow, /Konumu sigortalıdan teyit ediniz/);
    assert.match(workflow, /latitude/);
    const vendorStart = workflow.indexOf('export function buildVendorWhatsAppText');
    const vendorEnd = workflow.indexOf('\n}\n\n/**', vendorStart);
    assert.ok(vendorStart >= 0 && vendorEnd > vendorStart);
    const vendorMsg = workflow.slice(vendorStart, vendorEnd + 2);
    assert.ok(vendorMsg.length > 80);
    assert.match(vendorMsg, /Dosya No:/);
    assert.match(vendorMsg, /Hizmet:/);
    assert.match(vendorMsg, /Sigortalı Telefon:/);
    assert.match(vendorMsg, /VENDOR_LOCATION_CONFIRM_LINE/);
    assert.doesNotMatch(vendorMsg, /Alış/);
    assert.doesNotMatch(vendorMsg, /Satış/);
    assert.doesNotMatch(vendorMsg, /kâr/i);
    assert.doesNotMatch(vendorMsg, /formatTryAmount/);
    const steps = readFileSync(
      join(here, '../../../components/acil-operasyon-planlayicisi/planner-steps.tsx'),
      'utf8',
    );
    assert.match(steps, /Dosya bilgilerini gönder/);
    assert.match(steps, /vendorWhatsAppText/);
    assert.doesNotMatch(acilPage, /handleCloseAndFinance/);
    assert.match(acilPage, /openWhatsApp\(null, customerMsgPreview\)/);
    assert.match(
      readFileSync(join(here, '../../../components/acil-operasyon-planlayicisi/planner-steps.tsx'), 'utf8'),
      /Onay Talep Akışı/,
    );
    assert.doesNotMatch(acilPage, /documentKind="muvafakatname"/);
    assert.match(acilPage, /buildWorkStartWhatsAppText/);
    assert.doesNotMatch(acilPage, /operasyon-iki-kolon/);
    assert.doesNotMatch(acilPage, /1 · Operasyon başlangıç/);
    assert.doesNotMatch(acilPage, /Süreci Aç/);
    assert.doesNotMatch(acilPage, /PanelPillTabs/);
  });

  it('finans personeli hakediş listesini görür; vade yok', () => {
    assert.match(finans, /tedarikci-hakedis/);
    assert.match(finans, /getAcilVendorEntitlements/);
    assert.match(finans, /Vade uygulanmaz|Vade/);
    assert.match(grant, /acilHakedisDueDate/);
    assert.match(financeSvc, /emergencyVendorEntitlement/);
    assert.doesNotMatch(financeSvc, /paymentDueDays/);
    assert.match(finans, /acil-finans-liste-odeme/);
    assert.match(finans, /acil-finans-odeme-filtre/);
    assert.match(finans, /Tedarikçi Ödemesi/);
    assert.match(finans, /alwaysVisible: true/);
    assert.match(
      readFileSync(join(here, '../../../../../../apps/backend/src/modules/emergency/emergency-cases.service.ts'), 'utf8'),
      /htmlDocumentToPdf/,
    );
    assert.match(
      readFileSync(join(here, '../../../../../../apps/backend/src/modules/file-documents/file-documents.service.ts'), 'utf8'),
      /toInsuredFacingMatbuHtml/,
    );
  });

  it('tespit fotoğrafı blob ile görünür; sürükle bırak yazılır', () => {
    assert.match(photos, /createObjectURL|AuthBlobImg/);
    assert.match(photos, /entityDocumentFileUrl|entity-documents\/\$\{id\}\/file/);
    assert.match(photos, /onDrop=\{readOnly \? undefined : onDropFiles\}/);
    assert.match(photos, /sürükleyip bırakarak/);
    assert.match(acilPage, /FieldInspectionPhotosPanel entityType="emergency_case"/);
    assert.doesNotMatch(acilPage, /FieldInspectionPhotosPanel entityType="emergency_case" entityId=\{vaka.id\} readOnly/);
    const closure = readFileSync(
      join(here, '../../../components/file-documents/ClosurePhotosPanel.tsx'),
      'utf8',
    );
    assert.match(closure, /onDrop=\{onDropFiles\}/);
    assert.match(closure, /dosya-kapanis-surukle-birak/);
    assert.match(closure, /sürükleyip bırakarak/);
  });

  it('önizleme canlıda açılmaz; canlı planlayıcı paneli durur', () => {
    assert.match(preview, /NODE_ENV === 'production'/);
    assert.match(preview, /notFound\(\)/);
    assert.match(musteriGorunum, /acil-musteri-gorunum/);
    assert.match(musteriGorunum, /NODE_ENV === 'production'/);
    assert.match(musteriGorunum, /notFound\(\)/);
    assert.match(
      readFileSync(join(here, '../../../components/acil-operasyon-planlayicisi/AcilOperasyonPlanlayiciPanel.tsx'), 'utf8'),
      /acil-planlayici-ac/,
    );
  });

  it('5 kare sırası, onayda servis formu, kapanışta anket yok, kapat/finans ayrı', () => {
    const steps = readFileSync(
      join(here, '../../../components/acil-operasyon-planlayicisi/planner-steps.tsx'),
      'utf8',
    );
    const workflow = readFileSync(join(here, '[id]/acil-workflow.ts'), 'utf8');
    const backend = readFileSync(
      join(here, '../../../../../../apps/backend/src/modules/emergency/emergency-cases.service.ts'),
      'utf8',
    );
    const keys = [...steps.matchAll(/key: '([^']+)'/g)].map((m) => m[1]);
    assert.deepEqual(keys, ['ihbar', 'tedarikci_maliyet', 'onay', 'kapanis', 'finans']);
    assert.match(steps, /acil-odeme-evet-hayir/);
    assert.match(steps, /acil-finans-kdv/);
    assert.match(acilPage, /alisVatMode: displayAlisVat/);
    assert.match(acilPage, /satisVatMode: displaySatisVat/);
    assert.match(steps, /Anket \(tercihli\)/);
    assert.match(acilPage, /data-testid="acil-onay-evrak"/);
    assert.match(acilPage, /FileDocumentPanel/);
    assert.match(acilPage, /documentKind="matbu_evrak"/);
    assert.match(acilPage, /acil-finans-ozet-serit/);
    assert.doesNotMatch(acilPage, /acil-servis-anket-ozet/);
    assert.match(acilPage, /acil-gider-ozet/);
    assert.match(acilPage, /Buradan gider eklenmez/);
    assert.doesNotMatch(acilPage, /handleAddGider/);
    assert.match(acilPage, /closingStep/);
    assert.match(workflow, /const closeReady = requiredOps.photos;/);
    assert.match(workflow, /evaluateOperationStartGate/);
    assert.doesNotMatch(workflow, /surveyDone &&/);
    assert.match(backend, /buildAcilClosureReportPdf/);
    assert.match(backend, /ihbarAt:/);
    assert.match(backend, /serviceDeliveredAt/);
    assert.match(backend, /kapanis-raporu-/);
    assert.match(backend, /sendClosureEmailOnClose/);
    const approvalBlock = acilPage.slice(acilPage.indexOf('acil-onay-evrak'));
    assert.match(approvalBlock, /<FileDocumentPanel/);
    const beforeDrawer = acilPage.slice(0, acilPage.indexOf('approvalStep'));
    assert.doesNotMatch(beforeDrawer, /<FileDocumentPanel/);
  });
});
