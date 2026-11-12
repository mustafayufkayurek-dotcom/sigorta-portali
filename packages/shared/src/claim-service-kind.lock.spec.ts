import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  departmentCodeForNewClaim,
  matchDepartmentForFileSubjects,
  INSPECTOR_ALREADY_ASSIGNED_MESSAGE,
  isInspectionServiceKind,
  isHasarTespitClaim,
  isInspectorAlreadyAssigned,
  parseClaimServiceKind,
  plannerStepHiddenForServiceKind,
  repairReportRequiresPricedItems,
  hasarReportDocumentTitle,
  CLAIM_SERVICE_KINDS,
  CLAIM_SERVICE_KIND_LABEL,
  HASAR_TESPIT_SERVICE_CODE,
  CLAIM_LIST_PAGE_MAX,
  claimFileWhereForHizmet,
  claimFileWhereForMusteriKaynak,
  claimServiceKindFromConsultancyType,
  claimServiceKindFromListHizmet,
  consultancyTypesForNewFile,
  newClaimOpeningCaption,
  isHasarTespitConsultancyType,
  parseServiceTypeListPayload,
} from './claim-service-kind.ts';

const here = dirname(fileURLToPath(import.meta.url));

describe('claim service kind lock', () => {
  it('tespit onarım adımlarını gizler; onarım ve danışmanlık gizlemez', () => {
    assert.equal(parseClaimServiceKind('inspection'), 'inspection');
    assert.equal(isInspectionServiceKind('hasar_tespit'), true);
    assert.equal(plannerStepHiddenForServiceKind('supplier', 'inspection'), true);
    assert.equal(plannerStepHiddenForServiceKind('repair_whatsapp', 'inspection'), true);
    assert.equal(plannerStepHiddenForServiceKind('inspector', 'inspection'), false);
    assert.equal(plannerStepHiddenForServiceKind('file_close', 'inspection'), false);
    assert.equal(plannerStepHiddenForServiceKind('supplier', 'repair'), false);
    assert.equal(repairReportRequiresPricedItems('inspection'), false);
    assert.equal(repairReportRequiresPricedItems('repair'), true);
    assert.equal(repairReportRequiresPricedItems('consultancy'), true);
    assert.equal(
      repairReportRequiresPricedItems('consultancy', { code: HASAR_TESPIT_SERVICE_CODE, name: 'Hasar Tespit' }),
      false,
    );
    assert.equal(isHasarTespitClaim({ serviceKind: 'consultancy', consultancyServiceType: { code: HASAR_TESPIT_SERVICE_CODE } }), true);
    assert.equal(plannerStepHiddenForServiceKind('supplier', 'consultancy', { code: HASAR_TESPIT_SERVICE_CODE }), true);
    assert.equal(hasarReportDocumentTitle('inspection'), 'Hasar Tespit Raporu');
    assert.equal(hasarReportDocumentTitle('repair'), 'Hasar Onarım Raporu');
    assert.equal(departmentCodeForNewClaim({ customerSource: 'private', serviceKind: 'inspection' }), 'ozel-musteri');
    assert.equal(departmentCodeForNewClaim({ customerSource: 'expert', serviceKind: 'consultancy' }), 'danismanlik');
    assert.equal(departmentCodeForNewClaim({ customerSource: 'expert', serviceKind: 'repair' }), 'hasar-onarim');
    assert.equal(departmentCodeForNewClaim({ customerSource: 'expert', serviceKind: 'inspection' }), 'hasar-onarim');
    assert.equal(departmentCodeForNewClaim({ customerSource: 'insurance', serviceKind: 'inspection' }), 'hasar-onarim');
    assert.equal(departmentCodeForNewClaim({ customerSource: 'broker', serviceKind: 'repair' }), 'hasar-onarim');
    const lines = [
      { code: 'HASAR_ONARIM', name: 'Hasar Onarım' },
      { code: 'DEPT_DANISMANLIK', name: 'Danışmanlık' },
      { code: 'sovtaj', name: 'Sovtaj' },
    ];
    assert.equal(matchDepartmentForFileSubjects(lines, 'hasar-onarim')?.code, 'HASAR_ONARIM');
    assert.equal(matchDepartmentForFileSubjects(lines, 'danismanlik')?.code, 'DEPT_DANISMANLIK');
    assert.equal(matchDepartmentForFileSubjects(lines, 'hasar-onarim')?.name, 'Hasar Onarım');
    assert.equal(matchDepartmentForFileSubjects(lines, 'sovtaj')?.code, 'sovtaj');
  });

  it('Yeni Dosya üç hizmet seçeneğidir; liste Danışmanlık menüsüyle süzülür', () => {
    assert.deepEqual([...CLAIM_SERVICE_KINDS], ['inspection', 'repair', 'consultancy']);
    assert.equal(CLAIM_SERVICE_KIND_LABEL.inspection, 'Hasar Tespit');
    assert.equal(isHasarTespitConsultancyType({ code: HASAR_TESPIT_SERVICE_CODE, name: 'Hasar Tespit' }), true);
    assert.equal(claimServiceKindFromConsultancyType({ code: HASAR_TESPIT_SERVICE_CODE, name: 'Hasar Tespit' }), 'inspection');
    assert.equal(claimServiceKindFromConsultancyType({ code: 'sovtaj', name: 'Sovtaj' }), 'consultancy');
    assert.deepEqual(claimFileWhereForHizmet('hasar-tespit'), { serviceKind: 'inspection' });
    assert.deepEqual(claimFileWhereForHizmet('danismanlik'), { serviceKind: 'consultancy' });
    assert.deepEqual(claimFileWhereForHizmet('hasar-onarim'), {
      OR: [{ serviceKind: 'repair' }, { serviceKind: null }],
    });
    assert.equal(CLAIM_LIST_PAGE_MAX, 150);
    assert.deepEqual(claimFileWhereForMusteriKaynak('asistans'), {
      customer: { subType: { in: ['asistan_firmasi', 'asistans_firmasi'] } },
    });
    assert.equal(claimServiceKindFromListHizmet('hasar-tespit'), 'inspection');
    assert.equal(claimServiceKindFromListHizmet('danismanlik'), 'consultancy');
    assert.equal(claimServiceKindFromListHizmet('sovtaj'), 'consultancy');
    assert.equal(claimServiceKindFromListHizmet(''), 'repair');
    assert.equal(parseClaimServiceKind('hasar-tespit'), 'inspection');
    assert.equal(newClaimOpeningCaption('consultancy'), 'Danışmanlık Dosyası Açılıyor');
    assert.equal(newClaimOpeningCaption('inspection'), 'Hasar Tespit Dosyası Açılıyor');
    assert.equal(newClaimOpeningCaption('repair'), 'Hasar Dosyası Açılıyor');
  });

  it('Yeni Dosya Danışmanlık listesi Ayarlar kaydını alır; Hasar Tespit ayrıdır', () => {
    const rows = parseServiceTypeListPayload({
      success: true,
      data: [
        { id: '1', name: 'Hasar Tespit', code: HASAR_TESPIT_SERVICE_CODE, isActive: true },
        { id: '2', name: 'Sovtaj', code: 'sovtaj', isActive: true },
        { id: '3', name: 'Kapalı', code: 'kapali', isActive: false },
      ],
    });
    const listed = consultancyTypesForNewFile(rows);
    assert.equal(listed.length, 1);
    assert.equal(listed[0].name, 'Sovtaj');
  });

  it('aynı tespitçi ikinci kez atanmaz', () => {
    assert.equal(isInspectorAlreadyAssigned('a', 'a'), true);
    assert.equal(isInspectorAlreadyAssigned('a', 'b'), false);
    assert.match(INSPECTOR_ALREADY_ASSIGNED_MESSAGE, /zaten atanmış/);
  });

  it('onarım PDF irtibat telefonunu basmaz', () => {
    const pdf = readFileSync(
      join(here, '../../../apps/backend/src/modules/repair-reports/pdf/report-pdf.service.ts'),
      'utf8',
    );
    assert.doesNotMatch(pdf, /siteContactName/);
    assert.doesNotMatch(pdf, /siteContactPhone/);
  });

  it('Hasar Tespit raporu kalemsiz onaya gider; irtibat kutusu yedek alıcıdır', () => {
    const svc = readFileSync(
      join(here, '../../../apps/backend/src/modules/repair-reports/repair-reports.service.ts'),
      'utf8',
    );
    const claims = readFileSync(
      join(here, '../../../apps/backend/src/modules/claim-files/claim-files.service.ts'),
      'utf8',
    );
    const page = readFileSync(
      join(here, '../../../apps/web/src/app/panel/hasar-dosyalari/[id]/onarim-raporu/[reportId]/page.tsx'),
      'utf8',
    );
    assert.match(svc, /repairReportRequiresPricedItems/);
    assert.match(svc, /siteContactEmail/);
    assert.match(svc, /hasarReportDocumentTitle/);
    assert.match(page, /repairReportRequiresPricedItems\(report\?\.claimFile\?\.serviceKind, report\?\.claimFile\?\.consultancyServiceType\)/);
    assert.match(claims, /isHasarTespitConsultancyType/);
    assert.match(claims, /convertInspectionToRepair/);
    assert.match(claims, /consultancyServiceTypeId: null/);
  });

  it('Hasar Onarım eski dosyayı düşürmez; sayfa 150’de kesilmez', () => {
    const claims = readFileSync(
      join(here, '../../../apps/backend/src/modules/claim-files/claim-files.service.ts'),
      'utf8',
    );
    assert.match(claims, /CLAIM_LIST_PAGE_MAX/);
    assert.match(
      claims,
      /Math\.min\(Math\.max\(Number\(params\?\.limit\) \|\| 20, 1\), CLAIM_LIST_PAGE_MAX\)/,
    );
    assert.doesNotMatch(claims, /Number\(params\?\.limit\) \|\| 20, 100/);
  });
});
