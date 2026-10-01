import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  expectedDigitalApprovalCount,
  isDigitalApprovalBundleReady,
  parseHasPreApprovalWork,
  parsePreApprovalJobs,
  PRE_APPROVAL_DIGITAL_KIND,
} from './claim-pre-approval.ts';

const here = dirname(fileURLToPath(import.meta.url));

describe('claim pre-approval lock', () => {
  it('Hayır tek dijital onay; Evet ve iş seçilince iki onay gerekir', () => {
    assert.equal(parseHasPreApprovalWork(null), null);
    assert.equal(parseHasPreApprovalWork(false), false);
    assert.equal(parseHasPreApprovalWork(true), true);
    const jobs = parsePreApprovalJobs('[{"id":"wg1","name":"Söküm"}]');
    assert.equal(expectedDigitalApprovalCount(false, []), 1);
    assert.equal(expectedDigitalApprovalCount(true, jobs), 2);
    assert.equal(
      isDigitalApprovalBundleReady({
        hasPre: true,
        jobs,
        generalApproved: true,
        preApproved: false,
      }),
      false,
    );
    assert.equal(
      isDigitalApprovalBundleReady({
        hasPre: true,
        jobs,
        generalApproved: true,
        preApproved: true,
      }),
      true,
    );
    assert.equal(PRE_APPROVAL_DIGITAL_KIND, 'muvafakatname_on_is');
  });

  it('planlayıcı ön onay sorusu ve ikinci dijital belge durur', () => {
    const steps = readFileSync(
      join(here, '../../../apps/web/src/components/hasar-operasyon-planlayicisi/steps.tsx'),
      'utf8',
    );
    assert.match(steps, /ön onaylı iş var mı/);
    assert.match(steps, /PRE_APPROVAL_DIGITAL_KIND/);
    assert.match(steps, /muvafakatname_on_is|PRE_APPROVAL_DIGITAL_KIND/);
  });
});
