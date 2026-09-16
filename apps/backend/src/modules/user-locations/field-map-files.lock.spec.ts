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
    assert.match(service, /live-public-file-map\.json/);
    assert.match(service, /getPublicFileMap/);
    const pub = service.slice(
      service.indexOf('async getPublicFileMap'),
      service.indexOf('async cleanOldLocations'),
    );
    assert.doesNotMatch(pub, /fileNo/);
    assert.doesNotMatch(mapUi, /publicHasarPins/);
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
    assert.match(mapUi, /provinceMapBounds/);
    assert.match(mapUi, /İl Haritası/);
    assert.match(mapUi, /Rota başlangıç/);
    assert.match(mapUi, /Rota bitiş/);
    assert.match(mapUi, /filter-bar/);
    assert.match(mapUi, /page-header/);
    assert.match(mapUi, /regionPoints/);
    assert.match(mapUi, /OpsFirstRunNotice/);
    assert.doesNotMatch(mapUi, /Personel Seç/);
    assert.doesNotMatch(mapUi, /label: 'Personel'/);
  });

  it('harita yalnız Harita menüsü ve müşteri kartında durur; dosya listesinde yok', () => {
    assert.match(controller, /public-file-map/);
    assert.match(controller, /@Public\(\)/);
    assert.match(controller, /customerId/);
    assert.match(musteri, /FieldOperationsMap/);
    assert.match(musteri, /customerId=\{id!\}/);
    assert.match(harita, /FieldOperationsMap/);
    assert.match(harita, /ownerOnly=\{!isAdmin\}/);
    assert.match(harita, /showNotice/);
    assert.match(harita, /showPersonnelRoute/);
    assert.doesNotMatch(hasarListe, /FieldOperationsMap/);
    assert.doesNotMatch(operasyon, /FieldOperationsMap/);
  });

  it('sigorta ve operasyon ağı pinleri panel kutusu ile aynıdır', () => {
    const pinUtil = readFileSync(
      join(here, '../../../../../apps/web/src/utils/harita-pin-signal.ts'),
      'utf8',
    );
    const live3d = readFileSync(
      join(here, '../../../../../apps/web/src/components/portal/InsuranceLiveMap3D.tsx'),
      'utf8',
    );
    const portalMap = readFileSync(
      join(here, '../../../../../apps/web/src/components/portal/InsurancePortalMap.tsx'),
      'utf8',
    );
    const refMap = readFileSync(
      join(here, '../../../../../apps/web/src/components/portal/OperationReferenceMap.tsx'),
      'utf8',
    );
    assert.match(pinUtil, /buildPanelFileMarkerHtml/);
    assert.match(mapUi, /buildPanelFileMarkerHtml/);
    assert.match(live3d, /InsurancePortalMap/);
    assert.match(portalMap, /openstreetmap.org/);
    assert.match(portalMap, /buildPanelFileMarkerHtml/);
    assert.match(refMap, /buildPanelFileMarkerHtml/);
    assert.match(refMap, /openstreetmap.org/);
  });

  it('açık dosya pini sinyal verir; sağlık Bozulmuş yanıp söner', () => {
    assert.match(mapUi, /buildPanelFileMarkerHtml/);
    assert.match(mapUi, /jobStage !== 'kapandi'/);
    const health = readFileSync(
      join(here, '../../../../../apps/web/src/components/panel/PanelSystemHealth.tsx'),
      'utf8',
    );
    assert.match(health, /animate-pulse/);
    assert.match(health, /label: 'Bozulmuş'/);
    assert.match(health, /HEALTH_API/);
    const liveMap = readFileSync(
      join(here, '../claim-files/claim-files.service.ts'),
      'utf8',
    );
    assert.match(liveMap, /allowClosedFallback/);
    assert.match(liveMap, /isClosedState: true/);
  });

  it('sigorta ve asistans Canlı İzle şehir listesi değil haritadır', () => {
    const sigortaLive = readFileSync(
      join(here, '../../../../../apps/web/src/app/panel/sigorta-portal/canli-izle/page.tsx'),
      'utf8',
    );
    const asistansLive = readFileSync(
      join(here, '../../../../../apps/web/src/app/panel/asistans-portal/canli-izle/page.tsx'),
      'utf8',
    );
    assert.match(sigortaLive, /InsuranceLiveMap3D/);
    assert.match(asistansLive, /InsuranceLiveMap3D/);
    assert.doesNotMatch(sigortaLive, /Şehir Görünümü/);
    assert.doesNotMatch(asistansLive, /Şehir Görünümü/);
    assert.doesNotMatch(sigortaLive, /viewMode/);
    assert.doesNotMatch(asistansLive, /viewMode/);
  });
});
