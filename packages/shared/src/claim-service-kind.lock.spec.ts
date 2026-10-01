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
