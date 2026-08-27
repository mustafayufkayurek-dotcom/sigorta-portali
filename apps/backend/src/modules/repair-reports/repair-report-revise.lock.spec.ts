/**
 * Kilit: Hasar onarım raporunda dış onay / sunulmuş durumda da revizyon açılır.
 * Çalıştır: node --experimental-strip-types --test apps/backend/src/modules/repair-reports/repair-report-revise.lock.spec.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const shared = readFileSync(
  join(here, '../../../../../packages/shared/src/repair-report-revision.ts'),
  'utf8',
);

describe('hasar rapor revizyon durumu LOCK', () => {
  it('dış onay beklerken ve sunulmuşken revizyon açılır; taslakta açılmaz', () => {
    assert.match(shared, /sent_for_external_approval/);
    assert.match(shared, /submitted/);
    assert.match(shared, /canStartRepairReportRevisionFromStatus/);
    assert.match(shared, /repairReportClosesOnRevise/);
    assert.match(shared, /REPAIR_REPORT_REVISABLE_STATUSES/);
  });

  it('sunucu ve ekran aynı kuralı kullanır', () => {
    const svc = readFileSync(join(here, 'repair-reports.service.ts'), 'utf8');
    const page = readFileSync(
      join(here, '../../../../../apps/web/src/app/panel/hasar-dosyalari/[id]/onarim-raporu/[reportId]/page.tsx'),
      'utf8',
    );
    assert.match(svc, /canStartRepairReportRevisionFromStatus/);
    assert.match(svc, /repairReportClosesOnRevise/);
    assert.match(svc, /externalApproval\.updateMany/);
    assert.match(page, /canStartRepairReportRevisionFromStatus/);
    assert.match(page, /canReviseThisReport/);
    assert.match(page, /onStartRevision=\{canReviseThisReport \? handleRevise : undefined\}/);
  });
});
