/**
 * Hasar Tespit — Hizmet Bedeli ve Fatura (Mustafa · 13.11.2026 / netleşme 17.11.2026).
 * Rapor toplamı tespit edilen hasardır; gelir, bütçe, pano değildir. Hizmet bedelini yönetici / finans girer.
 * Dosya sorumlusu Fatura Talebi Aç ile satış talebi açar. Rapor zorunlu değildir. Onarım bitişi beklenmez.
 * Çalıştır: node --experimental-strip-types --test apps/backend/src/modules/finance/hasar-tespit-hizmet-bedeli.lock.spec.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { hasarOfficeCloseMissing } from '../../../../../packages/shared/src/hasar-office-close.ts';
import { resolveFileFeeCollectionSource } from '../../../../../packages/shared/src/collection-party.ts';
import { deriveOperationStageId, OPERATION_STAGES } from '../../../../../packages/shared/src/operation-status.ts';

const here = dirname(fileURLToPath(import.meta.url));
const read = (p: string) => readFileSync(join(here, p), 'utf8');

describe('Hasar Tespit hizmet bedeli LOCK', () => {
  it('rapor toplamı gelir ve bütçeye yazılmaz', () => {
    const revenue = read('claim-file-revenue.service.ts');
    const reports = read('../repair-reports/repair-reports.service.ts');
    assert.match(revenue, /async ensureFileFeeFromApprovedReport[\s\S]{0,400}if \(isInspectionServiceKind\(kind\?\.serviceKind\)\) return;/);
    assert.match(reports, /private async syncClaimFromLatestReport[\s\S]{0,700}if \(isInspectionServiceKind\(kind\?\.serviceKind\)\) return;/);
  });

  it('hizmet bedeli dosya müşterisine yazılır; tahsilat toplamı müşteriyi sayar', () => {
    assert.equal(resolveFileFeeCollectionSource({ serviceKind: 'inspection', insuranceCompanyId: 'x' }), 'customer');
    assert.equal(resolveFileFeeCollectionSource({ serviceKind: 'repair', insuranceCompanyId: 'x' }), 'insurance_company');
    assert.match(read('claim-file-revenue.service.ts'), /collectedFromInsurer \+ collectedFromInsured \+ collectedFromCustomer/);
    assert.match(read('financial-summary.service.ts'), /collectedFromInsurer \+ collectedFromInsured \+ collectedFromCustomer/);
    assert.match(read('dto/create-claim-file-revenue.dto.ts'), /@IsIn\(\['insurance_company', 'insured', 'customer'\]\)/);
    const panel = read('../../../../web/src/components/finance/ClaimFileGelirTahsilatPanel.tsx');
    assert.match(panel, /isInspectionServiceKind\(claim\?\.serviceKind\) \? HASAR_TESPIT_FEE_DESCRIPTION : ''/);
  });

  it('bedel finansa; fatura talebini dosya sorumlusu açar; rapor şart değil', () => {
    const requests = read('../invoice-requests/invoice-requests.service.ts');
    assert.match(requests, /async ensureHasarTespitInvoiceRequest\(/);
    assert.match(requests, /async requestHasarTespitInvoice\(/);
    assert.doesNotMatch(requests, /report_not_sent/);
    assert.doesNotMatch(requests, /HASAR_TESPIT_REPORT_SENT_STATUSES/);
    assert.match(requests, /reason: 'fee_missing'/);
    assert.match(requests, /status: \{ in: \['pending', 'approved', 'invoiced'\] \}/);
    const controller = read('../invoice-requests/invoice-requests.controller.ts');
    assert.match(controller, /@Post\('hasar-tespit\/:claimFileId'\)/);
    assert.doesNotMatch(read('claim-file-revenue.service.ts'), /ensureHasarTespitInvoiceRequest/);
    assert.doesNotMatch(read('../repair-reports/repair-reports.service.ts'), /ensureHasarTespitInvoiceRequest/);
    const panel = read('../../../../web/src/components/finance/ClaimFileGelirTahsilatPanel.tsx');
    assert.match(panel, /data-testid="hasar-tespit-fatura-talebi"/);
    assert.match(panel, /invoice-requests\/hasar-tespit\/\$\{claimId\}/);
    const invoices = read('../invoices/invoices.service.ts');
    assert.match(invoices, /const inspectionFee = isInspectionServiceKind\(claimFile\.serviceKind\);/);
    assert.match(invoices, /\? \(claimFile\.customerId \?\? null\)/);
  });

  it('kapanış onarım bitişi beklemez; fatura talebi yeter (rapor zorunlu değil)', () => {
    assert.deepEqual(hasarOfficeCloseMissing({ inspection: true, statusCode: 'budget_approved' }), [
      'Hasar Tespit Hizmet Bedeli fatura talebi',
    ]);
    assert.deepEqual(
      hasarOfficeCloseMissing({ inspection: true, statusCode: 'budget_approved', hasInvoiceRequest: true }),
      [],
    );
    assert.deepEqual(
      hasarOfficeCloseMissing({
        inspection: true,
        statusCode: 'budget_approved',
        reportSentToCustomer: true,
        hasInvoiceRequest: true,
      }),
      [],
    );
    assert.ok(hasarOfficeCloseMissing({ statusCode: 'budget_approved', hasApprovedReport: true }).includes('Onarım bitişi'));
  });

  it('onaylanan tespit «Onarım Aşamasında» yazmaz', () => {
    const id = deriveOperationStageId({ claimStatusCode: 'budget_approved', reportStatus: 'approved', serviceKind: 'inspection' });
    assert.equal(id, 'tespit_onaylandi');
    assert.equal(OPERATION_STAGES[id].label, 'Tespit Raporu Onaylandı');
    assert.equal(deriveOperationStageId({ claimStatusCode: 'budget_approved', reportStatus: 'approved' }), 'onaylandi');
  });

  it('kapanış maili hizmet bedeli ve ilk muhatap; masraf dosyaya; planlayıcı gizli adımda takılmaz', () => {
    const claims = read('../claim-files/claim-files.service.ts');
    assert.match(claims, /if \(inspectionFile\) \{[\s\S]{0,300}revenueType: 'file_fee'/);
    assert.match(claims, /if \(inspectionFile && dispatches\.length === 0\)/);
    const snap = read('../../../../web/src/components/hasar-operasyon-planlayicisi/claim-snapshot.ts');
    assert.match(snap, /plannerStepHiddenForServiceKind\(id, plannerServiceKind, claimFile\?\.consultancyServiceType\)/);
    const steps = read('../../../../web/src/components/hasar-operasyon-planlayicisi/steps.tsx');
    assert.match(steps, /!dropped && canEdit && !inspection/);
    assert.match(steps, /data-testid="hasar-tespit-kapanis-bedel"/);
  });
});
