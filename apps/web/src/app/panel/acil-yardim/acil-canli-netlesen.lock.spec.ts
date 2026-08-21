/**
 * Kilit: Canlıya alınan Acil netleşen iş — adres, telefon, TL, foto, hakediş vadesiz.
 * Çalıştır: node --experimental-strip-types --test apps/web/src/app/panel/acil-yardim/acil-canli-netlesen.lock.spec.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const acilPage = readFileSync(join(here, '[id]/page.tsx'), 'utf8');
const finans = readFileSync(join(here, 'finans/page.tsx'), 'utf8');
const photos = readFileSync(
  join(here, '../../../components/field-survey/FieldInspectionPhotosPanel.tsx'),
  'utf8',
);
const grant = readFileSync(
  join(here, '../../../../../../apps/backend/src/modules/emergency/acil-vendor-entitlement.ts'),
  'utf8',
);
const financeSvc = readFileSync(
  join(here, '../../../../../../apps/backend/src/modules/emergency/emergency-finance.service.ts'),
  'utf8',
);
const preview = readFileSync(
  join(here, '../../dev/acil-dosya-akis/page.tsx'),
  'utf8',
);

describe('acil canlı netleşen LOCK', () => {
  it('canlı dosyada adres formatter, aranır telefon, alış/satış TL', () => {
    assert.match(acilPage, /formatEmergencyFileAddress/);
    assert.match(acilPage, /PhoneContactActions/);
    assert.match(acilPage, /data-testid="alis-fiyati"/);
    assert.match(acilPage, /absolute right-2\.5[\s\S]*TL/);
    assert.match(acilPage, /Vade uygulanmaz/);
    assert.match(acilPage, /acil-hakedis-ilk-kullanim-seridi/);
    assert.match(acilPage, /OPS_NOTICE\.acilTedarikciHakedis/);
    assert.match(acilPage, /AcilOperasyonPlanlayiciPanel/);
    assert.match(acilPage, /acil-saha-tespit/);
  });

  it('finans personeli hakediş listesini görür; vade yok', () => {
    assert.match(finans, /tedarikci-hakedis/);
    assert.match(finans, /getAcilVendorEntitlements/);
    assert.match(finans, /Vade uygulanmaz|Vade/);
    assert.match(grant, /acilHakedisDueDate/);
    assert.match(financeSvc, /emergencyVendorEntitlement/);
    assert.doesNotMatch(financeSvc, /paymentDueDays/);
    assert.doesNotMatch(financeSvc, /VendorPaymentStatement/);
  });

  it('tespit fotoğrafı blob ile görünür', () => {
    assert.match(photos, /createObjectURL/);
    assert.match(photos, /entity-documents\/\$\{id\}\/download/);
  });

  it('önizleme canlıda açılmaz; canlı planlayıcı paneli durur', () => {
    assert.match(preview, /NODE_ENV === 'production'/);
    assert.match(preview, /notFound\(\)/);
    assert.match(
      readFileSync(join(here, '../../../components/acil-operasyon-planlayicisi/AcilOperasyonPlanlayiciPanel.tsx'), 'utf8'),
      /acil-planlayici-ac/,
    );
  });
});
