/**
 * Acil dijital onay: ihbarda adres ve hizmet talep; kapanışta servis formu.
 * Çalıştır: node --experimental-strip-types --test packages/shared/src/acil-digital-approval-pause.lock.spec.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  ACIL_ADRES_HIZMET_TALEP_KIND,
  acilDigitalApprovalGateOk,
  acilDigitalFormTitle,
  isAcilDigitalApprovalRequired,
} from './acil-digital-approval-pause.ts';

const here = dirname(fileURLToPath(import.meta.url));

describe('acil dijital onay / sözleşme LOCK', () => {
  it('ihbarda adres ve hizmet talep onayı; kapanışta servis formu', () => {
    assert.equal(isAcilDigitalApprovalRequired(), true);
    assert.equal(acilDigitalApprovalGateOk(false), false);
    assert.equal(acilDigitalApprovalGateOk(true), true);
    assert.equal(acilDigitalFormTitle(ACIL_ADRES_HIZMET_TALEP_KIND), 'Adres Ve Hizmet Talep Onayı');
    const gates = readFileSync(
      join(here, '../../../apps/web/src/components/acil-operasyon-planlayicisi/planner-gates.ts'),
      'utf8',
    );
    const page = readFileSync(
      join(here, '../../../apps/web/src/app/panel/acil-yardim/[id]/page.tsx'),
      'utf8',
    );
    assert.match(gates, /Servis Onay Formu Dijital Onayı Olmadan/);
    assert.match(gates, /Adres Ve Hizmet Talep Onayı Alın/);
    assert.match(page, /documentKind="adres_hizmet_talep"/);
    assert.match(page, /documentKind="matbu_evrak"/);
    assert.match(page, /FileDocumentPanel/);
    assert.doesNotMatch(page, /sözleşme uygulanmaz/);
    assert.doesNotMatch(page, /whatsapp_acil_ilk_bilgilendirme/);
    const steps = readFileSync(
      join(here, '../../../apps/web/src/components/acil-operasyon-planlayicisi/planner-steps.tsx'),
      'utf8',
    );
    assert.match(steps, /Adres Ve Hizmet Talep Onayı Oluştur/);
    assert.match(steps, /AcilVendorServiceContractPanel/);
    assert.doesNotMatch(steps, /sigortalı haber/);
    assert.doesNotMatch(steps, /Sigortalı Bilgilendirme/);
    const panel = readFileSync(
      join(here, '../../../apps/web/src/components/file-documents/FileDocumentPanel.tsx'),
      'utf8',
    );
    assert.match(panel, /Adres Ve Hizmet Talep Onayı Oluşturulmamış/);
    assert.match(panel, /Müşteri Nasıl Görür/);
    const qr = readFileSync(
      join(here, '../../../apps/backend/src/common/utils/document-qr.ts'),
      'utf8',
    );
    assert.match(qr, /Telefondan Onaylayınız/);
    assert.doesNotMatch(qr, /Telefondan onayla</);
  });
});
