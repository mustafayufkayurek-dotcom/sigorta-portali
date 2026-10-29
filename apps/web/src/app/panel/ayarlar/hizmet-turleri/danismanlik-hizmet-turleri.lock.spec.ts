/**
 * Danışmanlık hizmet türleri — Hasar Tespit sabit; yenisi Tanımlar’dan eklenir.
 * Çalıştır: node --experimental-strip-types --test apps/web/src/app/panel/ayarlar/hizmet-turleri/danismanlik-hizmet-turleri.lock.spec.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const page = readFileSync(join(here, 'page.tsx'), 'utf8');
const form = readFileSync(join(here, '../../../../components/claim-files/ClaimNewForm.tsx'), 'utf8');
const layout = readFileSync(join(here, '../../../../app/panel/layout.tsx'), 'utf8');
const opsNav = readFileSync(join(here, '../../../../utils/operasyon-nav.ts'), 'utf8');
const nav = readFileSync(join(here, '../../../../utils/settings-definition-nav.ts'), 'utf8');
const service = readFileSync(
  join(here, '../../../../../../backend/src/modules/service-types/service-types.service.ts'),
  'utf8',
);

describe('danışmanlık hizmet türleri kilidi', () => {
  it('Tanımlar ekranı Hasar Tespit’i silmez; menüde Danışmanlık durur; Yeni Dosya üç tuştur', () => {
    assert.match(page, /Danışmanlık Hizmet Türleri/);
    assert.match(page, /Hizmet Türü Ekle/);
    assert.match(page, /Örn\. sovtaj/);
    assert.match(page, /row\.isSystem/);
    assert.match(page, /Hasar Tespit durur/);
    assert.doesNotMatch(page, /SettingsLegacyRedirect/);
    assert.match(form, /CLAIM_SERVICE_KINDS\.map/);
    assert.match(form, /sm:grid-cols-3/);
    assert.match(form, /\/panel\/musteriler/);
    assert.match(opsNav, /title: 'Danışmanlık'/);
    assert.match(opsNav, /HASAR_HIZMET_TESPIT/);
    assert.match(layout, /buildOperasyonNavChildren/);
    assert.match(nav, /\/panel\/ayarlar\/hizmet-turleri/);
    assert.match(service, /HASAR_TESPIT_SERVICE_CODE/);
    assert.match(service, /Hasar Tespit silinemez/);
    assert.match(service, /CONSULTANCY_SERVICE_FAMILY/);
  });
});
