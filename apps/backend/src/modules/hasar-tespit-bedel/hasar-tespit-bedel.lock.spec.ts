/**
 * Hasar Tespit hizmet bedeli — arka taraf kilidi.
 * Çalıştır: node --experimental-strip-types --test apps/backend/src/modules/hasar-tespit-bedel/hasar-tespit-bedel.lock.spec.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { parseAkaryakitSayfasi } from './akaryakit-fiyat.util.ts';
import { rotaOtoyolParcalari } from './rota.util.ts';

const here = dirname(fileURLToPath(import.meta.url));
const read = (f: string) => readFileSync(join(here, f), 'utf8');

const SAYFA = `
<table><thead><tr><th>Şehir</th><th>V/Max Kurşunsuz 95</th><th>V/Max Diesel</th><th>Gazyağı</th><th>Kalorifer Yakıtı</th><th>Fuel Oil</th><th>PO/gaz Otogaz</th></tr></thead>
<tbody>
<tr class="price-row" data-disctrict-name="ANKARA"><td>ANKARA</td>
<td><span class="with-tax">72.20</span></td><td><span class="with-tax">96.40</span></td><td><span class="with-tax">91.02</span></td>
<td><span class="with-tax">65.71</span></td><td><span class="with-tax">49.95</span></td><td><span class="with-tax">50.79</span></td></tr>
<tr class="price-row" data-disctrict-name="GOLBASI"><td>GOLBASI</td>
<td><span class="with-tax">72.30</span></td><td><span class="with-tax">96.50</span></td><td><span class="with-tax">91.10</span></td>
<td><span class="with-tax">65.80</span></td><td><span class="with-tax">50.00</span></td><td><span class="with-tax">50.90</span></td></tr>
</tbody></table>`;

describe('Hasar Tespit hizmet bedeli arka taraf LOCK', () => {
  it('akaryakıt sayfası ilçe satırından KDV dahil okunur; ilçe yoksa il', () => {
    assert.deepEqual(parseAkaryakitSayfasi(SAYFA, 'Ankara', 'Gölbaşı', 'motorin'), { fiyat: 96.5, bolge: 'GOLBASI' });
    assert.deepEqual(parseAkaryakitSayfasi(SAYFA, 'Ankara', 'Gölbaşı', 'lpg'), { fiyat: 50.9, bolge: 'GOLBASI' });
    assert.deepEqual(parseAkaryakitSayfasi(SAYFA, 'Ankara', 'Etimesgut', 'benzin'), { fiyat: 72.2, bolge: 'ANKARA' });
    assert.equal(parseAkaryakitSayfasi('<html>bakım</html>', 'Ankara', null, 'motorin'), null);
  });

  it('rota otoyol kesimleri ref bazında toplanır; şehir yolu otoyol sayılmaz', () => {
    const parcalar = rotaOtoyolParcalari([
      { ref: 'O-4', name: 'Anadolu Otoyolu', distance: 40500 },
      { ref: 'O-5', name: 'İstanbul - Bursa Otoyolu', distance: 76500 },
      { ref: '34-11', name: 'Kavşak', distance: 2100 },
      { ref: 'D-100', name: 'E-5', distance: 9000 },
      { ref: 'O-4;E 80', name: '', distance: 1500 },
    ]);
    assert.deepEqual(parcalar.map((p) => [p.ref, p.km]), [['O-5', 76.5], ['O-4', 42]]);
  });

  it('gelire düşür: tek hizmet bedeli; gelir ve gider personelin tuşuyla; hata gizlenmez', () => {
    const src = read('hasar-tespit-bedel.service.ts');
    assert.match(src, /zaten gelirde/);
    assert.match(src, /hesaplaHasarTespitBedeli\(girdi\)/);
    assert.match(src, /this\.revenues\.create\(/);
    assert.match(src, /HASAR_TESPIT_FEE_DESCRIPTION/);
    assert.match(src, /this\.expenses\.create\(/);
    assert.match(src, /giderHatalari\.push/);
    assert.match(src, /HASAR_TESPIT_BEDEL_LOG_KIND/);
    assert.match(src, /isInspectionServiceKind/);
    assert.doesNotMatch(src, /catch \{\s*\/\*\s*ignore/);
  });

  it('kapılar yetkilidir; ekranda servis adı yazılmaz', () => {
    const ctl = read('hasar-tespit-bedel.controller.ts');
    assert.match(ctl, /@Put\('hasar-tespit-bedel\/arac'\)\s*\n\s*@RequirePermissions\('settings\.manage'\)/);
    assert.match(ctl, /@Put\('hasar-tespit-bedel\/tarife\/:customerId'\)\s*\n\s*@RequirePermissions\('customer\.update'\)/);
    assert.match(ctl, /gelire-dusur'\)\s*\n\s*@RequirePermissions\('claim_file\.update'\)/);
    const svc = read('hasar-tespit-bedel.service.ts');
    assert.doesNotMatch(svc, /BadRequestException\('[^']*(Google|OSRM|OpenAI|API)/);
    const app = readFileSync(join(here, '../../app.module.ts'), 'utf8');
    assert.match(app, /HasarTespitBedelModule/);
  });

  it('canlı alım kapısında durur', () => {
    const smoke = readFileSync(join(here, '../../../../../scripts/smoke-canli-bitmis-is.sh'), 'utf8');
    assert.match(smoke, /hasar-tespit-bedel\/hasar-tespit-bedel\.lock\.spec/);
  });
});
