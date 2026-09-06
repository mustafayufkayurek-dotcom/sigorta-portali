/**
 * Kilit: Harita tedarikçi GPS istemez. İl adı yeter. Açık + tercihle kapanan dosya.
 * Çalıştır: node --experimental-strip-types --test apps/backend/src/modules/user-locations/field-map-files.lock.spec.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const service = readFileSync(join(here, 'user-locations.service.ts'), 'utf8');
const controller = readFileSync(join(here, 'user-locations.controller.ts'), 'utf8');
const mapUi = readFileSync(
  join(here, '../../../../../apps/web/src/components/operasyon/FieldOperationsMap.tsx'),
  'utf8',
);
const harita = readFileSync(
  join(here, '../../../../../apps/web/src/app/panel/harita/page.tsx'),
  'utf8',
);
const musteri = readFileSync(
  join(here, '../../../../../apps/web/src/app/panel/musteriler/[id]/page.tsx'),
  'utf8',
);
const hasarListe = readFileSync(
  join(here, '../../../../../apps/web/src/app/panel/hasar-dosyalari/page.tsx'),
  'utf8',
);
const operasyon = readFileSync(
  join(here, '../../../../../apps/web/src/app/panel/operasyon/page.tsx'),
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
    assert.match(service, /resolveProvinceCoords/);
    assert.match(service, /resolveJobPlot/);
    assert.doesNotMatch(service, /hasarByVendor/);
    assert.doesNotMatch(service, /latestLiveByUserIds/);
  });

  it('tercihle kapanan Hasar ve Acil pin olarak durur', () => {
    assert.match(service, /isClosedState: true/);
    assert.match(service, /COZULDU/);
    assert.match(service, /FATURALANDILDI/);
    assert.match(service, /'kapandi'/);
  });

  it('ekran Hasar / Acil, bölge seçimi ve iş adresi lejantını gösterir', () => {
    assert.match(harita, /FieldOperationsMap/);
    assert.match(mapUi, /FILTER_CARDS/);
    assert.match(mapUi, /MapKpiCard/);
    assert.match(mapUi, /fileMarkerHtml/);
    assert.match(mapUi, /iş adresi/);
    assert.match(mapUi, /MapFilterField/);
    assert.match(mapUi, /Bölge seç/);
    assert.match(mapUi, /Rota başlangıç/);
    assert.match(mapUi, /Rota bitiş/);
    assert.match(mapUi, /filter-bar/);
    assert.match(mapUi, /page-header/);
    assert.match(mapUi, /regionPoints/);
    assert.match(mapUi, /OpsFirstRunNotice/);
    assert.doesNotMatch(mapUi, /Personel Seç/);
    assert.doesNotMatch(mapUi, /label: 'Personel'/);
  });

  it('müşteri ve dosya sorumlusu ekranlarında harita durur', () => {
    assert.match(controller, /ownerOnly/);
    assert.match(controller, /customerId/);
    assert.match(musteri, /FieldOperationsMap/);
    assert.match(musteri, /customerId=\{id!\}/);
    assert.match(hasarListe, /FieldOperationsMap/);
    assert.match(hasarListe, /ownerOnly/);
    assert.match(operasyon, /FieldOperationsMap/);
    assert.match(operasyon, /ownerOnly/);
  });
});
