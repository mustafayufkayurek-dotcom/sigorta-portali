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

  it('Çilingir dışı asistans rapor şeridi durur', () => {
    assert.match(acilPage, /OPS_NOTICE\.acilAsistansRaporOnay/);
    assert.match(acilPage, /acil-asistans-rapor-ilk-kullanim-seridi/);
    assert.equal(OPS_NOTICE.acilAsistansRaporOnay.id, 'acil-asistans-rapor-onay-v597');
    assert.match(OPS_NOTICE.acilAsistansRaporOnay.body, /Müşteri Onayına Gönder/);
    assert.match(OPS_NOTICE.acilAsistansRaporOnay.body, /Onay Talep adımında yazılır/);
    assert.doesNotMatch(OPS_NOTICE.acilAsistansRaporOnay.body, /Google/);
  });

  it('Acil hakediş şeridi durur', () => {
    assert.match(acilPage, /OPS_NOTICE\.acilTedarikciHakedis/);
    assert.match(acilPage, /acil-hakedis-ilk-kullanim-seridi/);
    assert.equal(OPS_NOTICE.acilTedarikciHakedis.id, 'acil-tedarikci-hakedis-v555');
    assert.match(OPS_NOTICE.acilTedarikciHakedis.body, /vade uygulanmaz/i);
    assert.match(OPS_NOTICE.acilTedarikciHakedis.body, /Finans tarafında işlem yapamazsınız/);
    assert.match(notice, /border-blue-100 bg-blue-50\/60/);
  });

  it('Finans ödeme kuyruğu şeridi durur', () => {
    const tahsilat = readFileSync(join(here, '../app/panel/finans/tahsilatlar/page.tsx'), 'utf8');
    const finansHome = readFileSync(join(here, '../app/panel/finans/page.tsx'), 'utf8');
    assert.match(tahsilat, /finans-odeme-kuyruk-ilk-kullanim-seridi/);
    assert.match(finansHome, /finans-odeme-kuyruk-ilk-kullanim-seridi/);
    assert.equal(OPS_NOTICE.finansTedarikciKuyruk.id, 'finans-tedarikci-kuyruk-v555');
    assert.match(OPS_NOTICE.finansTedarikciKuyruk.body, /finans tarafında işlem yapamaz/);
    assert.match(tahsilat, /emergencyCaseId/);
    assert.match(tahsilat, /acil_hakedis/);
    assert.match(tahsilat, /Vade yok/);
  });

  it('Acil yeni dosyada vekalet şeridi durur', () => {
    assert.match(acilForm, /OpsFirstRunNotice/);
    assert.match(acilForm, /OPS_NOTICE\.acilDosyaSorumlusuVekalet/);
    assert.match(acilForm, /dosya-sorumlusu-ilk-kullanim-seridi/);
    assert.match(OPS_NOTICE.acilDosyaSorumlusuVekalet.body, /tüm Acil kuyruğunu/);
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
    assert.match(masrafIsleme, /supplierCostHint/);
    assert.match(masrafIsleme, /hasar-hakedis-gider-seridi/);
    const hakedisPanel = readFileSync(
      join(here, '../components/finance/HasarFileHakedisPanel.tsx'),
      'utf8',
    );
    assert.match(hakedisPanel, /Hakediş Ver/);
    assert.match(hakedisPanel, /hasar-hakedis-ver-panel/);
    assert.match(hakedisPanel, /buildHasarHakedisGrantLines/);
    assert.match(hakedisPanel, /hasarHakedisKalan/);
    assert.doesNotMatch(hakedisPanel, /CommercialPricingDrawer/);
    assert.match(hakedisPanel, /hasar-gider-hakedis/);
    assert.match(hakedisPanel, /Gider/);
    assert.equal(OPS_NOTICE.hasarHakedisGider.id, 'hasar-hakedis-gider-v552');
    assert.match(OPS_NOTICE.hasarHakedisGider.body, /Finansa Aktar/);
    assert.match(OPS_NOTICE.hasarHakedisGider.body, /ödeme kuyruğu/);
    assert.match(OPS_NOTICE.hasarHakedisGider.body, /Düzenle/);
    assert.match(OPS_NOTICE.hasarHakedisGider.body, /her iş grubu/);
    assert.match(hakedisPanel, /Finansa Aktar/);
    assert.match(hakedisPanel, /tahsilatlar\?queue=payable/);
    assert.equal(OPS_NOTICE.hasarMasrafButceEk.id, 'hasar-masraf-butce-ek-v535');
    assert.match(OPS_NOTICE.hasarMasrafButceEk.body, /Bütçelenen/);
    assert.match(OPS_NOTICE.hasarMasrafButceEk.body, /Ek İş/);
    assert.match(hasarRapor, /OPS_NOTICE\.hasarRaporSonDegisiklik/);
    assert.match(opsListe, /OPS_NOTICE\.acilListeSonDegisiklik/);
    assert.match(opsListe, /acil-liste-ilk-kullanim-seridi/);
    assert.match(opsListe, /OPS_NOTICE\.acilVekaletKuyruk/);
    assert.match(opsListe, /acil-vekalet-kuyruk-seridi/);
    assert.equal(OPS_NOTICE.acilVekaletKuyruk.id, 'acil-vekalet-kuyruk-v537');
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
    assert.match(opsListe, /operasyon-acil-v19/);
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

  it('Hasar Dosya Onaylandı adımında satış faturası talebi şeridi durur', () => {
    const steps = readFileSync(
      join(here, '../components/hasar-operasyon-planlayicisi/steps.tsx'),
      'utf8',
    );
    const card = readFileSync(
      join(here, '../components/hasar-operasyon-planlayicisi/HasarSalesInvoiceRequestCard.tsx'),
      'utf8',
    );
    const finansTab = readFileSync(
      join(here, '../app/panel/hasar-dosyalari/[id]/_components/tabs/FinansTab.tsx'),
      'utf8',
    );
    assert.match(steps, /HasarSalesInvoiceRequestCard/);
    assert.match(card, /OPS_NOTICE\.hasarSigortaliOdemeli/);
    assert.match(card, /hasar-sigortali-odemeli-seridi/);
    assert.doesNotMatch(finansTab, /hasar-sigortali-odemeli-seridi/);
    assert.equal(OPS_NOTICE.hasarSigortaliOdemeli.id, 'hasar-satis-faturasi-talebi-v548');
    assert.match(OPS_NOTICE.hasarSigortaliOdemeli.body, /fatura sigortalıya/);
    assert.match(OPS_NOTICE.hasarSigortaliOdemeli.body, /sigorta şirketi carisine yazılmaz/);
  });

  it('Hasar Yeni Gelir çekmecesinde faturalı / faturasız şeridi durur', () => {
    const gelir = readFileSync(
      join(here, '../components/finance/ClaimFileGelirTahsilatPanel.tsx'),
      'utf8',
    );
    assert.match(gelir, /OPS_NOTICE\.hasarGelirFaturali/);
    assert.match(gelir, /hasar-gelir-faturali-seridi/);
    assert.match(gelir, /hasar-gelir-faturasiz/);
    assert.match(gelir, /KDV hesaplanmaz/);
    assert.equal(OPS_NOTICE.hasarGelirFaturali.id, 'hasar-gelir-faturali-v549');
    assert.match(OPS_NOTICE.hasarGelirFaturali.body, /Faturasız seçince KDV alanı kapanır/);
    assert.match(OPS_NOTICE.hasarGelirFaturali.body, /Tahsilat kaynağı dosyadan gelir/);
    assert.match(OPS_NOTICE.hasarGelirFaturali.body, /finans burada yeniden seçmez/);
  });

  it('Saha tespit sonlandır şeridi durur', () => {
    const hasarDosya = readFileSync(
      join(here, '../app/panel/hasar-dosyalari/[id]/page.tsx'),
      'utf8',
    );
    assert.match(hasarDosya, /OPS_NOTICE\.sahaTespitSonlandir/);
    assert.match(hasarDosya, /saha-tespit-sonlandir-seridi/);
    assert.equal(OPS_NOTICE.sahaTespitSonlandir.id, 'saha-tespit-sonlandir-v551');
    assert.match(OPS_NOTICE.sahaTespitSonlandir.body, /Tespiti Sonlandır/);
    assert.match(OPS_NOTICE.sahaTespitSonlandir.body, /dosya sorumlusuna düşer/);
    assert.match(OPS_NOTICE.sahaTespitSonlandir.body, /Kapatma dosya sorumlusundadır/);
    assert.doesNotMatch(OPS_NOTICE.sahaTespitSonlandir.body, /Google|API/);
  });

  it('Hasar tedarikçi onay maliyeti şeridi durur', () => {
    const vendorGuide = readFileSync(
      join(here, '../components/hasar-operasyon-planlayicisi/PlannerVendorContractGuide.tsx'),
      'utf8',
    );
    assert.match(vendorGuide, /OPS_NOTICE\.hasarVendorContractKind/);
    assert.match(vendorGuide, /hasar-vendor-contract-ilk-kullanim-seridi/);
    assert.equal(OPS_NOTICE.hasarVendorContractKind.id, 'hasar-vendor-contract-v563');
    assert.match(OPS_NOTICE.hasarVendorContractKind.body, /Onarım Planlama/);
    assert.match(OPS_NOTICE.hasarVendorContractKind.body, /düzeltme/);
    assert.match(OPS_NOTICE.hasarVendorContractKind.body, /Vergi No/);
    assert.match(OPS_NOTICE.hasarVendorContractKind.body, /T\.C\. Kimlik No/);
    assert.doesNotMatch(OPS_NOTICE.hasarVendorContractKind.body, /Google|API/);
  });

  it('Acil hizmet alım sözleşme şeridi durur', () => {
    const panel = readFileSync(
      join(here, '../components/acil-operasyon-planlayicisi/AcilVendorServiceContractPanel.tsx'),
      'utf8',
    );
    assert.match(panel, /OPS_NOTICE\.acilVendorServiceContract/);
    assert.match(panel, /acil-hizmet-alim-ilk-kullanim-seridi/);
    assert.equal(OPS_NOTICE.acilVendorServiceContract.id, 'acil-hizmet-alim-sozlesme-v583');
    assert.match(OPS_NOTICE.acilVendorServiceContract.body, /hizmet alım sözleşmesi/);
    assert.match(OPS_NOTICE.acilVendorServiceContract.body, /WhatsApp/);
    assert.doesNotMatch(OPS_NOTICE.acilVendorServiceContract.body, /Google|API/);
    assert.doesNotMatch(OPS_NOTICE.acilVendorServiceContract.body, /onarım sözleşmesi/i);
  });

  it('Tedarikçi listesinde eksik kimlik ismin yanında durur', () => {
    const tedarikci = readFileSync(
      join(here, '../app/panel/tedarikciler/page.tsx'),
      'utf8',
    );
    assert.match(tedarikci, /tedarikci-satir-kimlik-eksik/);
    assert.match(tedarikci, /vendorIdentityGapLabel/);
    assert.doesNotMatch(tedarikci, /tedarikci-kimlik-eksik-seridi/);
    assert.doesNotMatch(tedarikci, /tedarikci-kimlik-eksik-filtre/);
    assert.match(OPS_NOTICE.tedarikciKimlikEksik.body, /T\.C\./);
    assert.match(OPS_NOTICE.tedarikciKimlikEksik.body, /vergi no/);
    assert.match(OPS_NOTICE.tedarikciKimlikEksik.body, /sözleşme çıkmaz/);
    assert.doesNotMatch(OPS_NOTICE.tedarikciKimlikEksik.body, /Google|API/);
  });

  it('Hasar ofis dosya kapat şeridi durur', () => {
    const steps = readFileSync(
      join(here, '../components/hasar-operasyon-planlayicisi/steps.tsx'),
      'utf8',
    );
    assert.match(steps, /OPS_NOTICE\.hasarOfisDosyaKapat/);
    assert.match(steps, /hasar-ofis-dosya-kapat-seridi/);
    assert.equal(OPS_NOTICE.hasarOfisDosyaKapat.id, 'hasar-ofis-dosya-kapat-v556');
    assert.match(OPS_NOTICE.hasarOfisDosyaKapat.body, /Süreçler bitmeden/);
    assert.match(OPS_NOTICE.hasarOfisDosyaKapat.body, /Dosyayı İptal Et/);
    assert.match(OPS_NOTICE.hasarOfisDosyaKapat.body, /iptal nedeni zorunlu/);
    assert.match(OPS_NOTICE.hasarOfisDosyaKapat.body, /Saha kapatmaz/);
    assert.doesNotMatch(OPS_NOTICE.hasarOfisDosyaKapat.body, /Google|API/);
  });

  it('sağ panel kaydır şeridi durur', () => {
    assert.equal(OPS_NOTICE.sagPanelKaydir.id, 'sag-panel-kaydir-v556');
    assert.match(OPS_NOTICE.sagPanelKaydir.body, /sağa kayar/);
    assert.match(OPS_NOTICE.sagPanelKaydir.body, /Başka sayfaya/);
    assert.match(OPS_NOTICE.sagPanelKaydir.body, /kayıt hatırlatması/);
    assert.doesNotMatch(OPS_NOTICE.sagPanelKaydir.body, /Google|API/);
    const slide = readFileSync(join(here, '../components/SlidePanel.tsx'), 'utf8');
    assert.match(slide, /OPS_NOTICE\.sagPanelKaydir/);
  });

  it('harita iş adresi şeridi durur; Google yok', () => {
    const harita = readFileSync(join(here, '../components/operasyon/FieldOperationsMap.tsx'), 'utf8');
    assert.match(harita, /OpsFirstRunNotice/);
    assert.match(harita, /OPS_NOTICE\.haritaDosyaIsAdresi/);
    assert.match(harita, /harita-dosya-is-adresi-seridi/);
    assert.equal(OPS_NOTICE.haritaDosyaIsAdresi.id, 'harita-bolge-il-v569');
    assert.match(OPS_NOTICE.haritaDosyaIsAdresi.body, /iş adresidir/);
    assert.match(OPS_NOTICE.haritaDosyaIsAdresi.body, /Hasar ve Acil ayrı/);
    assert.match(OPS_NOTICE.haritaDosyaIsAdresi.body, /Bölge Seç/);
    assert.doesNotMatch(OPS_NOTICE.haritaDosyaIsAdresi.body, /Google|API/);
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
