/**
 * Kilit: Acil tedarikçi metni Hasar onarım sözleşmesi değildir.
 * Çalıştır: node --experimental-strip-types --test packages/shared/src/acil-vendor-service-contract.lock.spec.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  ACIL_VENDOR_SERVICE_CONTRACT_CLAUSES,
  ACIL_VENDOR_SERVICE_CONTRACT_TITLE,
  acilVendorServiceContractTextIsClean,
  renderAcilVendorServiceContractClauses,
} from './acil-vendor-service-contract.ts';

const here = dirname(fileURLToPath(import.meta.url));

describe('acil tedarikçi hizmet alım sözleşmesi LOCK', () => {
  it('başlık ve maddelerde yasak kelime yok', () => {
    assert.equal(ACIL_VENDOR_SERVICE_CONTRACT_TITLE, 'Tedarikçi Hizmet Alım Sözleşmesi');
    const bundle = [
      ACIL_VENDOR_SERVICE_CONTRACT_TITLE,
      ...ACIL_VENDOR_SERVICE_CONTRACT_CLAUSES.flatMap((c) => [c.title, c.body]),
    ].join('\n');
    assert.equal(acilVendorServiceContractTextIsClean(bundle), true);
    const rendered = renderAcilVendorServiceContractClauses({
      tedarikciKimlik: 'Vergi No 1234567890',
      hizmetBedeli: '1.250,00 ₺',
      imzaSureGun: '3',
    });
    assert.equal(acilVendorServiceContractTextIsClean(rendered.map((c) => c.body).join('\n')), true);
    assert.match(rendered[0].body, /yerinde verilir/);
    assert.doesNotMatch(bundle, /saat/);
  });

  it('Acil planlayıcıda durur; Hasar onarım başlığı Acil HTML’de yok', () => {
    const steps = readFileSync(
      join(here, '../../../apps/web/src/components/acil-operasyon-planlayicisi/planner-steps.tsx'),
      'utf8',
    );
    const panel = readFileSync(
      join(here, '../../../apps/web/src/components/acil-operasyon-planlayicisi/AcilVendorServiceContractPanel.tsx'),
      'utf8',
    );
    const svc = readFileSync(
      join(here, '../../../apps/backend/src/modules/vendor-contracts/vendor-contracts.service.ts'),
      'utf8',
    );
    const publicPage = readFileSync(
      join(here, '../../../apps/web/src/app/sozlesme/[token]/page.tsx'),
      'utf8',
    );
    assert.match(steps, /AcilVendorServiceContractPanel/);
    assert.match(panel, /Tedarikçi Hizmet Alım Sözleşmesi/);
    assert.doesNotMatch(panel, /Onarım Sözleşmesi/);
    assert.match(svc, /buildAcilServiceContractHtml/);
    const acilFn = svc.slice(
      svc.indexOf('buildAcilServiceContractHtml'),
      svc.indexOf('private buildContractHtml'),
    );
    assert.match(acilFn, /TEDARİKÇİ HİZMET ALIM SÖZLEŞMESİ/);
    assert.doesNotMatch(acilFn, /Hasar Adresi/);
    assert.doesNotMatch(acilFn, /ONARIM SÖZLEŞMESİ/);
    assert.doesNotMatch(acilFn, /Sigorta Şirketi/);
    assert.match(svc, /insuranceCompanyName: null/);
    assert.match(publicPage, /Hizmeti Onayla/);
    const acilCards = publicPage.slice(
      publicPage.indexOf('{(isAcilHizmet'),
      publicPage.indexOf(': [', publicPage.indexOf('{(isAcilHizmet')),
    );
    assert.doesNotMatch(acilCards, /Sigorta/);
    assert.match(svc, /emergencyCaseId/);
    const dto = readFileSync(
      join(here, '../../../apps/backend/src/modules/vendor-contracts/dto/vendor-contracts.dto.ts'),
      'utf8',
    );
    assert.match(dto, /emergencyCaseId\?:/);
    assert.match(dto, /@IsOptional\(\)/);
    assert.doesNotMatch(dto, /ValidateIf/);
  });
});
