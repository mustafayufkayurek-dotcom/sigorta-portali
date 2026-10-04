/**
 * Alan açıklaması i — yazılım geneli; kutu altı nasıl-doldurulur yazısı yok.
 * Çalıştır: node --experimental-strip-types --test apps/web/src/components/ui/field-help-tip.lock.spec.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const webSrc = join(here, '../..');

function read(rel: string) {
  return readFileSync(join(webSrc, rel), 'utf8');
}

describe('alan açıklaması i kilidi', () => {
  it('FieldHelpTip tıklanınca açılır; sayfa başlığı i ayrı durur', () => {
    const tip = read('components/ui/FieldHelpTip.tsx');
    const hint = read('components/ui/HintIcon.tsx');
    assert.match(tip, /export function FieldHelpTip/);
    assert.match(tip, /export function FieldLabel/);
    assert.match(tip, /onClick/);
    assert.match(tip, /aria-label="Açıklama"/);
    assert.match(hint, /return null/);
  });

  it('müşteri, tedarikçi ve kullanıcı FormField yardım alır', () => {
    assert.match(read('app/panel/musteriler/page.tsx'), /help\?: string/);
    assert.match(read('app/panel/tedarikciler/page.tsx'), /help\?: string/);
    assert.match(read('app/panel/kullanicilar/page.tsx'), /help\?: string/);
    assert.match(read('components/settings/SettingsUI.tsx'), /export function SettingsFieldLabel/);
  });

  it('nasıl doldurulur yazısı kutu altında görünür paragraf değildir', () => {
    const files = [
      'app/panel/musteriler/page.tsx',
      'app/panel/tedarikciler/page.tsx',
      'app/panel/ayarlar/evrak-turleri/page.tsx',
      'app/panel/ayarlar/bolgesel-zamlar/page.tsx',
      'app/panel/ayarlar/mahaller/page.tsx',
      'app/panel/ayarlar/entegrasyonlar/page.tsx',
      'app/panel/hasar-dosyalari/[id]/_components/DosyaBilgileriEditModal.tsx',
      'components/operation-inbox/InboxComposeModal.tsx',
      'components/operation-inbox/InboxReplyModal.tsx',
      'app/panel/acil-yardim/[id]/page.tsx',
      'components/emergency/EmergencyCaseNewForm.tsx',
      'components/claim-files/ClaimNewForm.tsx',
    ];
    const forbidden = [
      /Dosya listelerinde uzun unvan yerine bu ad gösterilir\.<\/p>/,
      /Sıra numarası alfabetik dizilime göre otomatik atanır\.<\/p>/,
      /Pozitif değer = zam artışı\. Örn: 15 → baz fiyat × 1\.15<\/p>/,
      /Bu alt bölge hangi mahale bağlanacak\? Örn: Salon Zemin → Salon<\/p>/,
      /Gönderen adı — en fazla 11 karakter<\/p>/,
      /Aktif sözleşmede teslim tarihi varsa o tarih önceliklidir\.<\/p>/,
      /Ek, asıl yazı ile birlikte gider\. Fotoğraflar gönderime uygun küçültülür\.<\/p>/,
      /Rapora eklenir\. Sürükleyip bırakabilirsiniz\.<\/p>/,
      /Bitişik yazabilirsiniz; boşluklar eşleştirmede dikkate alınmaz\.<\/p>/,
    ];
    for (const rel of files) {
      const src = read(rel);
      for (const re of forbidden) {
        assert.doesNotMatch(src, re, rel);
      }
    }
  });

  it('hata, boş, yükleme ve tıklanır yol durur', () => {
    const acilNew = read('components/emergency/EmergencyCaseNewForm.tsx');
    assert.match(acilNew, /Tedarikçiler Sayfasından Ekleyin/);
    assert.match(acilNew, /href="\/panel\/tedarikciler"/);
    const photos = read('components/field-survey/FieldInspectionPhotosPanel.tsx');
    assert.match(photos, /saha-tespit-surukle-birak/);
    const closure = read('components/file-documents/ClosurePhotosPanel.tsx');
    assert.match(closure, /dosya-kapanis-surukle-birak/);
    const finans = read('app/panel/hasar-dosyalari/[id]/_components/tabs/FinansOzetPanel.tsx');
    assert.match(finans, /Henüz finansal özet yok/);
  });
});
