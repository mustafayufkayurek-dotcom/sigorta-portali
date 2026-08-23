/**
 * Canlı operasyon değişikliği iş ekranında bir kez anlatılır; kılavuz tek başına yetmez.
 * Çalıştır: node --experimental-strip-types --test apps/web/src/utils/ops-first-run-notice.lock.spec.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { OPS_NOTICE } from './ops-first-run-notice.ts';

const here = dirname(fileURLToPath(import.meta.url));
const acilPage = readFileSync(
  join(here, '../app/panel/acil-yardim/[id]/page.tsx'),
  'utf8',
);
const acilForm = readFileSync(
  join(here, '../components/emergency/EmergencyCaseNewForm.tsx'),
  'utf8',
);
const notice = readFileSync(
  join(here, '../components/operasyon/OpsFirstRunNotice.tsx'),
  'utf8',
);
const guide = readFileSync(
  join(here, '../../public/docs/01-personel-kullanim-kilavuzu.html'),
  'utf8',
);

describe('operasyon ilk kullanım şeridi LOCK', () => {
  it('şerit Anladım ile kapanır; Google / API yok', () => {
    assert.match(notice, /compact/);
    assert.match(notice, /Anladım/);
    assert.match(notice, /dismissOpsNotice/);
    assert.doesNotMatch(notice, /Google/);
  });

  it('Acil dosyada kayıtlı tedarikçi şeridi durur', () => {
    assert.match(acilPage, /OpsFirstRunNotice/);
    assert.match(acilPage, /OPS_NOTICE\.acilKayitliTedarikci/);
    assert.match(acilPage, /tedarikci-ilk-kullanim-seridi/);
    assert.equal(OPS_NOTICE.acilKayitliTedarikci.id, 'acil-kayitli-tedarikci-v520');
    assert.match(OPS_NOTICE.acilKayitliTedarikci.body, /İlk 3/);
    assert.match(OPS_NOTICE.acilKayitliTedarikci.body, /Diğer Kayıtlılar/);
    assert.match(OPS_NOTICE.acilKayitliTedarikci.body, /Kapalı/);
  });

  it('Acil hakediş şeridi durur', () => {
    assert.match(acilPage, /OPS_NOTICE\.acilTedarikciHakedis/);
    assert.match(acilPage, /acil-hakedis-ilk-kullanim-seridi/);
    assert.equal(OPS_NOTICE.acilTedarikciHakedis.id, 'acil-tedarikci-hakedis-v524');
    assert.match(OPS_NOTICE.acilTedarikciHakedis.body, /vade uygulanmaz/i);
    assert.match(notice, /border-blue-100 bg-blue-50\/60/);
  });

  it('Acil yeni dosyada vekalet şeridi durur', () => {
    assert.match(acilForm, /OpsFirstRunNotice/);
    assert.match(acilForm, /OPS_NOTICE\.acilDosyaSorumlusuVekalet/);
    assert.match(acilForm, /dosya-sorumlusu-ilk-kullanim-seridi/);
  });

  it('Hasar ve Acil listesinde son canlı iş şeridi durur', () => {
    const hasarListe = readFileSync(join(here, '../app/panel/hasar-dosyalari/page.tsx'), 'utf8');
    const hasarDosya = readFileSync(join(here, '../app/panel/hasar-dosyalari/[id]/page.tsx'), 'utf8');
    const hasarRapor = readFileSync(
      join(here, '../app/panel/hasar-dosyalari/[id]/onarim-raporu/[reportId]/page.tsx'),
      'utf8',
    );
    const opsListe = readFileSync(join(here, '../app/panel/operasyon/page.tsx'), 'utf8');
    assert.match(hasarListe, /OPS_NOTICE\.hasarListeSonDegisiklik/);
    assert.match(hasarListe, /hasar-liste-ilk-kullanim-seridi/);
    assert.match(hasarListe, /ops-row-approval-72h/);
    assert.match(hasarListe, /ops-72s-chip/);
    assert.match(hasarListe, /OpsStripKpi/);
    assert.match(hasarListe, /dense/);
    assert.match(hasarListe, /ops-queue-table/);
    const css = readFileSync(join(here, '../app/globals.css'), 'utf8');
    assert.match(css, /ops-row-approval-72h/);
    assert.match(css, /table-row\.ops-row-approval-72h:nth-child/);
    assert.match(css, /ops-72s-chip/);
    assert.match(css, /prefers-reduced-motion: reduce/);
    assert.match(OPS_NOTICE.hasarListeSonDegisiklik.body, /yanıp söner/);
    assert.match(hasarDosya, /OPS_NOTICE\.hasarDosyaSonDegisiklik/);
    const masrafIsleme = readFileSync(
      join(here, '../components/finance/FileMasrafIsleme.tsx'),
      'utf8',
    );
    assert.match(masrafIsleme, /OPS_NOTICE\.hasarMasrafButceEk/);
    assert.equal(OPS_NOTICE.hasarMasrafButceEk.id, 'hasar-masraf-butce-ek-v535');
    assert.match(OPS_NOTICE.hasarMasrafButceEk.body, /Bütçelenen/);
    assert.match(OPS_NOTICE.hasarMasrafButceEk.body, /Ek İş/);
    assert.match(hasarRapor, /OPS_NOTICE\.hasarRaporSonDegisiklik/);
    assert.match(opsListe, /OPS_NOTICE\.acilListeSonDegisiklik/);
    assert.match(opsListe, /acil-liste-ilk-kullanim-seridi/);
    assert.match(opsListe, /OpsStripKpi/);
    assert.match(opsListe, /dense/);
    const picker = readFileSync(join(here, '../components/ui/TableColumnPicker.tsx'), 'utf8');
    assert.doesNotMatch(picker, /wrap = false \}: PanelTableTdProps/);
    assert.match(css, /\.ops-queue-table \.table-td > div/);
    assert.match(hasarListe, /ops-queue-table/);
    assert.match(opsListe, /ops-queue-table/);
    assert.match(acilPage, /OPS_NOTICE\.acilDosyaSonDegisiklik/);
    assert.equal(OPS_NOTICE.hasarListeSonDegisiklik.id, 'hasar-liste-v536');
    assert.match(OPS_NOTICE.hasarListeSonDegisiklik.body, /Ödemeler/);
    assert.match(OPS_NOTICE.hasarListeSonDegisiklik.body, /ihbarı geçen ofis/);
    assert.match(OPS_NOTICE.hasarListeSonDegisiklik.body, /karttaki Kısa Ad/);
    assert.match(OPS_NOTICE.hasarListeSonDegisiklik.body, /yanıp söner/);
    assert.match(hasarListe, /MissingShortNameBanner/);
    assert.match(opsListe, /MissingShortNameBanner/);
    assert.equal(OPS_NOTICE.acilListeSonDegisiklik.id, 'acil-liste-v529');
    assert.match(OPS_NOTICE.acilListeSonDegisiklik.body, /Ödeme Durumu/);
    assert.match(OPS_NOTICE.acilListeSonDegisiklik.body, /Hasar kuyruğu/);
    assert.match(opsListe, /operasyon-acil-v17/);
    assert.match(opsListe, /queueThClass/);
    assert.match(opsListe, /const acilList = filterType === 'acil'/);
    assert.match(opsListe, /pagedRows\.length === 0/);
    assert.doesNotMatch(opsListe, /Toplam Satır/);
    assert.match(OPS_NOTICE.acilDosyaSonDegisiklik.body, /Konum/);
  });

  it('Müşteri kartında yetkili adı şeridi durur', () => {
    const musteri = readFileSync(join(here, '../app/panel/musteriler/page.tsx'), 'utf8');
    assert.match(musteri, /OPS_NOTICE\.musteriYetkiliAd/);
    assert.match(musteri, /musteri-yetkili-ad-ilk-kullanim-seridi/);
    assert.equal(OPS_NOTICE.musteriYetkiliAd.id, 'musteri-yetkili-ad-v533');
    assert.match(OPS_NOTICE.musteriYetkiliAd.body, /Yazılım ad uydurmaz/);
    assert.doesNotMatch(musteri, /OpenAI|ChatGPT|Google Places/);
  });

  it('personel kılavuzu Acil tedarikçi ve dosya sorumlusu maddelerini taşır', () => {
    assert.match(guide, /id="acil-yardim"/);
    assert.match(guide, /Önerilen Tedarikçiler/);
    assert.match(guide, /kayıtlı tedarikçileri gösterir/);
    assert.match(guide, /2\. kez çalışılırsa yöneticiye e-posta/);
    assert.match(guide, /Acil Yardım vekaleti olan finans personeli/);
    assert.match(guide, /Acil tedarikçisine vade uygulanmaz/);
    assert.doesNotMatch(guide, /Google Places/);
  });
});
