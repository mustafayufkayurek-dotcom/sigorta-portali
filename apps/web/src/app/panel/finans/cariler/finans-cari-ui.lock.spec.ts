/**
 * Finans cari ekranı — muhasebe dili, Excel, işlemler.
 * Çalıştır: node --experimental-strip-types --test apps/web/src/app/panel/finans/cariler/finans-cari-ui.lock.spec.ts
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));

describe('Finans cari UI LOCK', () => {
  it('liste muhasebe sütunları, açıklama, Excel ve işlemler durur', () => {
    const list = readFileSync(join(here, 'page.tsx'), 'utf8');
    const detail = readFileSync(join(here, '[id]/page.tsx'), 'utf8');
    const home = readFileSync(join(here, '../page.tsx'), 'utf8');
    const layout = readFileSync(join(here, '../../layout.tsx'), 'utf8');
    const disiplin = readFileSync(
      join(here, '../../../../components/finance/FinansDonemDisiplinModal.tsx'),
      'utf8',
    );
    const kart = readFileSync(
      join(here, '../../../../utils/finans-merkez-kart.ts'),
      'utf8',
    );
    const shared = readFileSync(
      join(here, '../../../../../../../packages/shared/src/finans-cari.ts'),
      'utf8',
    );
    const panelUi = readFileSync(
      join(here, '../../../../components/finance/FinansPanelUI.tsx'),
      'utf8',
    );

    assert.match(list, /cari-aciklama/);
    assert.match(list, /Açıklama/);
    assert.match(list, /cari-excel-aktar/);
    assert.doesNotMatch(list, /cari-donem-sonu/);
    assert.match(list, /Excel/);
    const donem = readFileSync(join(here, 'donem-sonu/page.tsx'), 'utf8');
    assert.match(donem, /donem-sonu-tablo/);
    assert.match(donem, /donem-sonu-bos-hal/);
    assert.match(donem, /Mali Yıl Kapanışı/);
    assert.match(donem, /Dönemi Kapat/);
    assert.match(donem, /Yeni dönem açılmaz/);
    assert.match(donem, /FinansDonemDisiplinModal/);
    assert.match(donem, /OPS_NOTICE\.finansDonemSonu/);
    assert.match(donem, /usePanelConfirm/);
    assert.match(donem, /backHref="\/panel\/finans"/);
    assert.match(donem, /Finans Merkezi/);
    assert.doesNotMatch(donem, /window\.confirm/);
    assert.doesNotMatch(donem, /Kapatılabilir/);
    assert.doesNotMatch(donem, /donem-sonu-hazirlik-checklist/);
    assert.doesNotMatch(donem, /donem-sonu-kapat-engel/);
    assert.doesNotMatch(donem, /Açık dosya:/);
    assert.match(disiplin, /Dönem Sonuna Git/);
    assert.match(disiplin, /\/panel\/finans\/cariler\/donem-sonu/);
    assert.match(list, /label: 'Borç'/);
    assert.match(list, /label: 'Alacak'/);
    assert.match(list, /label: 'Bakiye'/);
    assert.match(list, /FINANS_PARTY_CARI_ROW_ACTIONS/);
    assert.match(list, /party-cari-satir-islemler/);
    assert.match(list, /Pasife Al/);
    assert.match(list, /Hareket Ekle/);
    assert.match(list, /Mail Gönder/);
    assert.match(list, /WhatsApp/);
    assert.match(list, /Bakiye Kopyala/);
    assert.match(list, /openWhatsAppChat/);
    assert.match(list, /mailto:/);
    assert.match(list, /cari-telefon/);
    assert.match(list, /cari-eposta/);
    assert.match(list, /buildCariBakiyeIletisimMesaji/);
    assert.match(list, /cariBakiyeMetin/);
    assert.match(list, /Borç \/ Alacak/);
    assert.match(list, /table-cols:finans-cariler-v3/);
    assert.match(list, /defaultWidth: 200/);
    assert.match(list, /defaultWidth: 148/);
    assert.match(list, /defaultWidth: 152/);
    assert.match(list, /defaultWidth: 188/);
    assert.match(list, /max-w-2xl/);
    assert.match(list, /block truncate/);
    assert.match(list, /whitespace-nowrap/);
    assert.doesNotMatch(list, /Borç Bakiyesi \(Alacağımız\)/);
    assert.doesNotMatch(list, /Açılış Yönü/);
    assert.doesNotMatch(list, /defaultWidth: 220/);

    assert.match(detail, /cari-ekstre-excel/);
    assert.match(detail, /cari-ekstre-mail/);
    assert.match(detail, /cari-ekstre-whatsapp/);
    assert.match(detail, /cari-ekstre-ara/);
    assert.match(detail, /cari-hareket-aciklama/);
    assert.match(detail, /cariBakiyeMetin/);
    assert.match(detail, /Borç \/ Alacak/);
    assert.match(detail, /yazdir/);

    assert.match(home, /finans-merkez-kurulum-seridi/);
    assert.match(home, /finans-kurulum-adim-listesi/);
    assert.match(home, /finans-sirket-seyir-baslik/);
    assert.match(home, /Şirket Seyri/);
    assert.match(home, /finans-seyir-cari-ozet/);
    assert.match(home, /finans-hedef-ciro-onerisi/);
    assert.match(home, /finans-hedef-ciro-kabul/);
    assert.match(home, /finans-hedef-ciro-incele/);
    assert.match(home, /finans-hedef-ciro-incele-modal/);
    assert.match(home, /finans-hedef-ciro-eksik/);
    assert.match(home, /finans-hedef-ciro-incele-eksik/);
    assert.match(home, /Hedef Ciro Detayı/);
    assert.match(home, /Kabul Et/);
    assert.match(home, /Kabul Ediliyor…/);
    assert.doesNotMatch(home, /hedefKaydediliyor \? 'Kaydediliyor…' : 'Kabul Et'/);
    assert.match(home, /İncele/);
    assert.match(home, /finans-hedef-ciro-incele-ozet/);
    assert.match(home, /finans-sabit-gider-yonetimi/);
    assert.match(home, /Sabit Gider Yönetimi/);
    assert.match(home, /Aylık tanımlı toplam/);
    assert.match(home, /FinansPanelCard/);
    assert.match(home, /FinansDataTable/);
    assert.match(home, /TrAmountInput/);
    assert.match(home, /Yeni Gider/);
    assert.match(home, /Gideri Tanımla/);
    assert.match(home, /finans-sabit-gider-tanim-form/);
    assert.match(home, /finans-sabit-gider-tanim-ozet/);
    assert.match(home, /ödeme yapıldığı anlamına gelmez/);
    assert.match(home, /FinansModal/);
    assert.match(home, /FinansDataTable embedded/);
    assert.match(panelUi, /export function FinansModal/);
    assert.match(panelUi, /embedded/);
    assert.match(home, /size="lg"/);
    assert.match(home, /finans-isletme-sabit-ad/);
    assert.match(home, /finans-isletme-sabit-kategori/);
    assert.match(home, /finans-isletme-sabit-tutar/);
    assert.match(home, /finans-isletme-sabit-baslangic/);
    assert.match(home, /finans-isletme-sabit-temizle/);
    assert.match(home, /finans-isletme-sabit-ekle/);
    assert.match(home, /finans-isletme-sabit-toplam/);
    assert.match(home, /finans-isletme-sabit-liste/);
    assert.match(home, />Gider</);
    assert.match(home, /Aylık Tutar/);
    assert.match(home, />Durum</);
    assert.match(home, /Aktif/);
    assert.doesNotMatch(home, /Son İşlem/);
    assert.doesNotMatch(home, /table-fixed/);
    assert.doesNotMatch(home, /FinansFormPanel/);
    assert.doesNotMatch(home, /finans-aylik-isletme-sabiti/);
    assert.doesNotMatch(home, /Aylık İşletme Sabiti/);
    assert.doesNotMatch(home, /Sabit Gider Ekle/);
    assert.doesNotMatch(home, /Gerçekleşen Ciro/);
    assert.doesNotMatch(home, /Net Kâr/);
    assert.match(home, /toTitleCaseTR/);
    assert.match(home, /sabitEkleAcik/);
    assert.match(home, /finans-hedef-sabit-karta-git/);
    assert.match(home, /Sabit Gider Yönetimine Git/);
    assert.match(home, /isletmeSabitKalemleri/);
    assert.match(home, /kaydetIsletmeSabit/);
    assert.doesNotMatch(home, /finans-isletme-sabit-ekle-satir/);
    assert.doesNotMatch(home, /Kalem Ekle/);
    assert.doesNotMatch(home, />Kalem</);
    assert.doesNotMatch(home, /Kira, maaş, araç/);
    assert.doesNotMatch(home, /Örn\. 45000/);
    assert.match(home, /carilerHedefBaglamYol/);
    assert.match(home, /incele=hedef|incele.*hedef/);
    assert.match(home, /Sıfır hedef/);
    assert.doesNotMatch(home, /finans-hedef-ciro-sabit-input/);
    assert.doesNotMatch(home, /finans-hedef-ciro-sabit-kaydet/);
    assert.doesNotMatch(home, /Kaydet Ve Öneriyi Hesapla/);
    assert.doesNotMatch(home, /manuelSabitAylik/);
    assert.doesNotMatch(home, /handleHedefSabitKaydet/);
    assert.doesNotMatch(home, /finans-hedef-ciro-ilgili-konular/);
    assert.doesNotMatch(home, /finans-hedef-konu-sabit/);
    assert.doesNotMatch(home, /sabitGiderHedefBaglamYol/);
    assert.doesNotMatch(home, /finans-donem-unutma-uyari/);
    assert.doesNotMatch(home, /FinanceKpiGroup/);
    assert.doesNotMatch(list, /finans-kurulum-seridi/);

    assert.match(kart, /hedefCiroDonYol/);
    assert.match(kart, /carilerHedefBaglamYol/);
    assert.match(kart, /masrafEkleYol/);

    const sabit = readFileSync(join(here, '../sabit-giderler/page.tsx'), 'utf8');
    assert.match(sabit, /sabit-gider-masraf-ekle/);
    assert.match(sabit, /sabit-gider-bos-hal/);
    assert.match(sabit, /masrafEkleYol/);
    assert.match(sabit, /Masraf Ekle/);
    assert.match(list, /FinansHedefBaglamSeridi/);
    assert.match(list, /Hedef Ciroya Dön|hedefCiroDonYol/);
    assert.match(
      readFileSync(join(here, '../masraflar/page.tsx'), 'utf8'),
      /yeni.*=== ['"]1['"]|get\('yeni'\)/,
    );

    assert.match(layout, /FinansDonemDisiplinModal/);
    assert.match(layout, /ToastProvider[\s\S]*FinansDonemDisiplinModal[\s\S]*<\/ToastProvider>/);
    assert.match(layout, /canClosePeriod=\{isFinance\}/);
    assert.match(disiplin, /finans-donem-disiplin-modal/);
    assert.match(disiplin, /Dönem Ve Görev Denetimi/);
    assert.match(disiplin, /finans-disiplin-oneri-sirasi/);
    assert.match(disiplin, /finans-disiplin-donem-kapat/);
    assert.match(disiplin, /finans-disiplin-devam/);
    assert.match(disiplin, /finans-disiplin-acik-acil/);
    assert.match(disiplin, /Açık dosya/);
    assert.match(disiplin, /fatura talebi yok/);
    assert.match(disiplin, /canClosePeriod/);
    assert.match(kart, /finansDonemUyariDismissKey/);
    assert.match(shared, /maliDonemPromptFromLastPosting/);
    assert.match(shared, /addCalendarMonthsIso/);
    assert.match(shared, /proposeFinansHedefCiro/);
    assert.match(shared, /Masraf kaynağı/);
    assert.match(shared, /label: 'Borç'/);
    assert.doesNotMatch(shared, /Borç Bakiyesi \(Alacağımız\)/);
  });
});
