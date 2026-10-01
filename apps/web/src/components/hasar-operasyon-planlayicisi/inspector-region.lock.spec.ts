/**
 * Tespitçi bölge, arama ve ikinci atama.
 * Çalıştır: node --experimental-strip-types --test apps/web/src/components/hasar-operasyon-planlayicisi/inspector-region.lock.spec.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));

describe('tespitçi bölge kilidi', () => {
  it('saha listesi il/ilçe ile gelir; Türkiye yedek yok; arama ve ikinci atama durur', () => {
    const panel = readFileSync(join(here, 'OperasyonPlanlayiciPanel.tsx'), 'utf8');
    const steps = readFileSync(join(here, 'steps.tsx'), 'utf8');
    const service = readFileSync(
      join(here, '../../../../backend/src/modules/claim-files/claim-files.service.ts'),
      'utf8',
    );
    assert.match(panel, /params: \{ role: 'field_staff', city, district \}/);
    assert.doesNotMatch(panel, /Meridyen Saha · Türkiye/);
    assert.match(steps, /tespitci-arama/);
    assert.match(steps, /Bu bölgede tespitçi yok/);
    assert.match(steps, /INSPECTOR_ALREADY_ASSIGNED_MESSAGE/);
    assert.match(steps, /SUPPLIER_ALREADY_ASSIGNED_MESSAGE/);
    assert.match(service, /purpose !== 'inspector'/);
    assert.doesNotMatch(service, /buildInspectorFallbackWhere\(\)/);
    assert.match(service, /filterStaffByFileArea/);
    assert.match(service, /area\?\.city !== undefined/);
    assert.match(panel, /onarima-cevir/);
  });
});
