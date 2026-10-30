import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  departmentCodeForNewClaim,
  INSPECTOR_ALREADY_ASSIGNED_MESSAGE,
  isInspectionServiceKind,
  isInspectorAlreadyAssigned,
  parseClaimServiceKind,
  plannerStepHiddenForServiceKind,
  CLAIM_SERVICE_KINDS,
  CLAIM_SERVICE_KIND_LABEL,
  HASAR_TESPIT_SERVICE_CODE,
  claimFileWhereForHizmet,
  claimFileWhereForMusteriKaynak,
  claimServiceKindFromConsultancyType,
  consultancyTypesForNewFile,
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
    assert.equal(departmentCodeForNewClaim({ customerSource: 'private', serviceKind: 'inspection' }), 'ozel-musteri');
    assert.equal(departmentCodeForNewClaim({ customerSource: 'expert', serviceKind: 'consultancy' }), 'danismanlik');
    assert.equal(departmentCodeForNewClaim({ customerSource: 'expert', serviceKind: 'repair' }), 'hasar-onarim');
    assert.equal(departmentCodeForNewClaim({ customerSource: 'expert', serviceKind: 'inspection' }), 'danismanlik');
  });

  it('Yeni Dosya üç hizmet tuşudur; liste Danışmanlık menüsüyle süzülür', () => {
    assert.deepEqual([...CLAIM_SERVICE_KINDS], ['inspection', 'repair', 'consultancy']);
    assert.equal(CLAIM_SERVICE_KIND_LABEL.inspection, 'Hasar Tespit');
    assert.equal(isHasarTespitConsultancyType({ code: HASAR_TESPIT_SERVICE_CODE, name: 'Hasar Tespit' }), true);
    assert.equal(claimServiceKindFromConsultancyType({ code: HASAR_TESPIT_SERVICE_CODE, name: 'Hasar Tespit' }), 'inspection');
    assert.equal(claimServiceKindFromConsultancyType({ code: 'sovtaj', name: 'Sovtaj' }), 'consultancy');
    assert.deepEqual(claimFileWhereForHizmet('hasar-tespit'), { serviceKind: 'inspection' });
    assert.deepEqual(claimFileWhereForHizmet('danismanlik'), {
      serviceKind: { in: ['inspection', 'consultancy'] },
    });
    assert.deepEqual(claimFileWhereForMusteriKaynak('asistans'), {
      customer: { subType: { in: ['asistan_firmasi', 'asistans_firmasi'] } },
    });
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
});
