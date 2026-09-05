/**
 * Kilit: Harita tedarikçi GPS istemez. Açık dosya iş adresinde, Hasar/Acil ayrı.
 * Çalıştır: node --experimental-strip-types --test apps/backend/src/modules/user-locations/field-map-files.lock.spec.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const service = readFileSync(join(here, 'user-locations.service.ts'), 'utf8');
const harita = readFileSync(
  join(here, '../../../../../apps/web/src/app/panel/harita/page.tsx'),
  'utf8',
);

describe('saha haritası dosya iş adresi LOCK', () => {
  it('pin iş adresidir; tedarikçi telefonu zorunlu değildir', () => {
    assert.match(service, /actorType: 'file_hasar'/);
    assert.match(service, /actorType: 'file_acil'/);
    assert.match(service, /locationKind: 'job'/);
    assert.match(service, /propertyAddress/);
    assert.match(service, /hasarJobStage/);
    assert.match(service, /acilJobStage/);
    assert.doesNotMatch(service, /hasarByVendor/);
    assert.doesNotMatch(service, /latestLiveByUserIds/);
  });

  it('ekran Hasar / Acil ve iş adresi lejantını gösterir', () => {
    assert.match(harita, /file_hasar/);
    assert.match(harita, /file_acil/);
    assert.match(harita, /key: 'hasar'/);
    assert.match(harita, /key: 'acil'/);
    assert.match(harita, /fileMarkerHtml/);
    assert.match(harita, /iş adresi/);
    assert.match(harita, /OpsFirstRunNotice/);
  });
});
