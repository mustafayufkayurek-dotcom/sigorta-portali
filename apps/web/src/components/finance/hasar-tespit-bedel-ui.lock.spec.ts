/**
 * Hasar Tespit hizmet bedeli ekranları kilidi.
 * Çalıştır: node --experimental-strip-types --test apps/web/src/components/finance/hasar-tespit-bedel-ui.lock.spec.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const web = join(here, '../..');
const read = (p: string) => readFileSync(join(web, p), 'utf8');

describe('Hasar Tespit hizmet bedeli ekran LOCK', () => {
  it('dosya gelir panelinde yalnız tespit dosyasında ve yalnız yönetici / finansa Hizmet Bedeli Hesapla durur', () => {
    const panel = read('components/finance/ClaimFileGelirTahsilatPanel.tsx');
    assert.match(
      panel,
      /const bedelHesabi = bedelYetki && (?:inspectionFile|isInspectionServiceKind\(claim\?\.serviceKind\))/,
    );
    assert.match(panel, /setBedelYetki\(canSeeHasarTespitBedelClient\(\)\)/);
    assert.match(panel, /\{bedelHesabi \? \(\s*<button[\s\S]*?hasar-tespit-bedel-hesapla/);
    assert.match(panel, /data-testid="hasar-tespit-fatura-talebi"/);
    assert.match(panel, /invoice-requests\/hasar-tespit\/\$\{claimId\}/);
    const role = read('utils/hasar-tespit-bedel-role.ts');
    assert.match(role, /canSeeHasarTespitBedel\(/);
    assert.match(panel, /Hizmet Bedeli Hesapla/);
    assert.match(panel, /<HasarTespitBedelHesapPanel claimId=\{claimId\}/);
  });

  it('hesap ekranı satır satır; eksik fiyat uyarısı; Gelire Düşür personelde', () => {
    const src = read('components/finance/HasarTespitBedelHesapPanel.tsx');
    assert.match(src, /hesaplaHasarTespitBedeli\(girdi\)/);
    assert.match(src, /Rotayı Hesapla/);
    assert.match(src, /Eksik fiyat/);
    assert.match(src, /hasar-tespit-gelire-dusur/);
    assert.match(src, /OPS_NOTICE\.hasarTespitBedelHesapla/);
    assert.match(src, /zaten|gelirde/);
    assert.doesNotMatch(src, /Google|OSRM|OpenAI|yapay zek/i);
    assert.doesNotMatch(src, /uppercase/);
  });

  it('Ayarlar ve müşteri kartı yerinde', () => {
    assert.match(read('app/panel/ayarlar/tanimlar/page.tsx'), /\/panel\/ayarlar\/hasar-tespit-arac/);
    assert.match(read('utils/settings-definition-nav.ts'), /hasar-tespit-arac/);
    const arac = read('app/panel/ayarlar/hasar-tespit-arac/page.tsx');
    assert.match(arac, /Köprü Ve Tünel Geçişleri/);
    assert.match(arac, /Ücretli Otoyollar/);
    const musteri = read('app/panel/musteriler/[id]/page.tsx');
    assert.match(musteri, /Hasar Tespit Tarifesi/);
    assert.match(musteri, /activeTab === 'tarife' && canSeeHasarTespitBedel\(userRoleCode\) && <CustomerHasarTespitTarifeTab customerId=/);
    assert.match(musteri, /tab\.id !== 'tarife' \|\| \(canSeeHasarTespitBedel\(userRoleCode\)/);
    const tarife = read('components/customers/CustomerHasarTespitTarifeTab.tsx');
    assert.match(tarife, /Maliyetler \+ Hizmet Payı|TARIFE_YONTEM_LABEL/);
    assert.match(tarife, /Örn\. rapor hazırlama/);
  });

  it('personel şeridi bir kez anlatır', () => {
    const notice = read('utils/ops-first-run-notice.ts');
    assert.match(notice, /hasarTespitBedelHesapla: \{\s*id: 'hasar-tespit-bedel-hesapla-v692'/);
    assert.match(notice, /Gelire Düşür hizmet bedelini gelire/);
  });

  it('canlı alım kapısında durur', () => {
    const smoke = readFileSync(join(web, '../../../scripts/smoke-canli-bitmis-is.sh'), 'utf8');
    assert.match(smoke, /hasar-tespit-bedel-ui\.lock\.spec/);
  });
});
