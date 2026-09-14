/** Canlı operasyon değişikliği — personel iş ekranında bir kez görür. Kılavuz yetmez. */

export const OPS_FIRST_RUN_STORAGE_PREFIX = 'meridyen-ops-notice:';

export const OPS_NOTICE = {
  sahaTespitSonlandir: {
    id: 'saha-tespit-sonlandir-v551',
    title: 'Tespiti sonlandır',
    body:
      'Tespit bitince Tespiti Sonlandır deyin. Dosya dosya sorumlusuna düşer; dosya kapanmaz. Kapatma dosya sorumlusundadır.',
  },
  acilKayitliTedarikci: {
    id: 'acil-kayitli-tedarikci-v520',
    title: 'Tedarikçi Önerisi',
    body:
      'Üstte Memnuniyet Ve Fiyat Avantajı Yüksek İlk 3 Tedarikçi Açık Önerilir. Diğer Kayıtlılar Aynı Listede Kapalı Kalır; Açıp Bakabilirsiniz. Olumsuz Değerlendirmede Yazılım Uyarır; Alternatif Bakın. Aynı Olumsuz Tedarikçiyle 2. Kez Çalışılırsa Yöneticiye E-Posta Gider.',
  },
  acilDosyaSorumlusuVekalet: {
    id: 'acil-dosya-sorumlusu-vekalet-v515',
    title: 'Dosya Sorumlusu',
    body:
      'Acil Yardım vekaleti olan finans personeli de bu listede görünür. Dosyayı ona atayabilirsiniz. Vekil tüm Acil kuyruğunu işler; kayıtta işlemi yapan vekil durur.',
  },
  acilVekaletKuyruk: {
    id: 'acil-vekalet-kuyruk-v537',
    title: 'Acil vekalet',
    body:
      'Dosya sorumlusu vekaleti ile tüm Acil kuyruğunu görürsünüz. Yeni dosya, mail aktarımı ve atama ofis sorumlusu gibidir. İşlem sizin adınıza kayda geçer.',
  },
  acilTedarikciHakedis: {
    id: 'acil-tedarikci-hakedis-v555',
    title: 'Tedarikçi Hakedişi',
    body:
      'İş bitince bu dosyanın tedarikçisine hakediş verilir. Ödendi veya ödenmedi kaydı finansa göndermeden önce bu dosyada sizin işinizdir. Finansa gittikten sonra Ödendi işlemini finans personeli yapar. Finans tarafında işlem yapamazsınız. İşlemi yapan adıyla kaydolur. Vade uygulanmaz.',
  },
  finansTedarikciKuyruk: {
    id: 'finans-tedarikci-kuyruk-v555',
    title: 'Ödeme Kuyruğu',
    body:
      'Hasar hakediş ve avans burada durur. Acil’de Ödendi işlemini finans personeli yapar; dosya sorumlusu finans tarafında işlem yapamaz, yalnız kendi dosyasında finansa göndermeden önce kayıt düşer. İşlemi yapan kaydolur. Acil’de vade yoktur. Hasar’da 15 veya 30 gün vade durur.',
  },
  hasarListeSonDegisiklik: {
    id: 'hasar-liste-v536',
    title: 'Bu sayfada ne değişti',
    body:
      'Ödemeler sütunu durur; gizlenemez. Tedarikçi ödemesi Ödendi, Ödenmedi veya Kayıt yok olarak görünür. Müşteri sütununda ihbarı geçen ofis üsttedir; karttaki Kısa Ad varsa o basılır, yoksa karttaki unvan. Altta sigorta soluktur. Sayfa altında kaç dosya göreceğinizi seçersiniz. 72 saat aşan satır kırmızı yanıp söner.',
  },
  hasarDosyaSonDegisiklik: {
    id: 'hasar-dosya-v534',
    title: 'Bu dosyada ne değişti',
    body:
      'Hasar Tespit’te tahmini süre ve görüşme notu yok. Randevu notu sesle yazılır. Tespitçi ve sigortalı WhatsApp zorunlu; tedarikçi görev notu ve WhatsApp aynı sayfada. Dosya Onaylandı, Raporlar’daki onayı gösterir. Dijital onay onarımın başında; mutabakat/muvafakat tek belge. Anket onarım bitişinde. Resim ve belgeler Evraklar → Tespit Ve Onarım’dadır.',
  },
  hasarMasrafButceEk: {
    id: 'hasar-masraf-butce-ek-v535',
    title: 'Masraf yeri',
    body:
      'Masraf eklerken Bütçelenen veya Ek İş seçin. Ek iş kârı ayrı ve toplamda görünür. Araç kirası, maaş, SGK ve vergi bu dosyaya yazılmaz; Finans’te yönetim gideri havuzuna işlenir, ayın son günü dağıtılmadıysa finans ve yöneticiye hatırlatılır.',
  },
  hasarHakedisGider: {
    id: 'hasar-hakedis-gider-v552',
    title: 'Tedarikçi hakedişi',
    body:
      'Aynı tedarikçinin her iş grubu ayrı Finansa Aktar ile ödeme kuyruğuna düşer. Bütçelenen fiyatı Düzenle ile değiştirirsiniz. Aynı evrakı yeniden yüklemezsiniz.',
  },
  hasarSigortaliOdemeli: {
    id: 'hasar-satis-faturasi-talebi-v548',
    title: 'Satış faturası talebi',
    body:
      'Rapor onaylanınca burada fatura kime kesilsin sorulur. Finansa talep et deyince finans kuyruğuna düşer. Bu seçim Finans’te tekrar sorulmaz. Sigortalı ödemeli dosyada tahsilat sigortalıdan, fatura sigortalıya kesilir; sigorta şirketi carisine yazılmaz.',
  },
  hasarGelirFaturali: {
    id: 'hasar-gelir-faturali-v549',
    title: 'Gelir kaydı',
    body:
      'Faturalı kayıtta KDV hesaplanır. Faturasız seçince KDV alanı kapanır; yazdığınız tutar net kayda geçer. Tahsilat kaynağı dosyadan gelir. Fatura kime, Dosya Onaylandı adımında sorulur; finans burada yeniden seçmez. Onaylı rapor dosya bedelini aynı tarafa yazar.',
  },
  hasarVendorContractKind: {
    id: 'hasar-vendor-contract-v563',
    title: 'Tedarikçi sözleşmesi',
    body:
      'Onarım Planlama’da sözleşmeyi görürsünüz. Metni dosya sorumlusu değiştirmez; yanlışsa yöneticiden düzeltme ister. Şirkette Vergi No, şahısta T.C. Kimlik No satırı basılır; şahısta numara yoksa noktalı satır durur. Gönderim WhatsApp ile onay sayfasına gider.',
  },
  acilVendorServiceContract: {
    id: 'acil-hizmet-alim-sozlesme-v583',
    title: 'Hizmet alım sözleşmesi',
    body:
      'Acil Yardım’da tedarikçiye kısa hizmet alım sözleşmesi gider. Başlık onarım değildir. WhatsApp ile onay sayfasına gider. Ad soyad, kutu ve imza Hasar’daki gibi durur; metin daha sadedir.',
  },
  tedarikciKimlikEksik: {
    id: 'tedarikci-kimlik-eksik-v562',
    title: 'Eksik kimlik',
    body:
      'Şahıs tedarikçide T.C. kimlik no zorunlu değildir. Şirkette vergi no zorunludur; yoksa listede Vergi No Eksik yazar ve sözleşme çıkmaz. Sözleşmede şirket ise Vergi No, şahıs ise T.C. Kimlik No satırı basılır.',
  },
  hasarOfisDosyaKapat: {
    id: 'hasar-ofis-dosya-kapat-v556',
    title: 'Dosyayı kapat',
    body:
      'Süreçler bitmeden dosya kapanmaz. Onaylı rapor ve onarım bitişi gerekir. Hizmet iptalse Dosyayı İptal Et; iptal nedeni zorunlu. İptal eden ve işlem zamanı dosyada durur. Saha kapatmaz.',
  },
  hasarRaporSonDegisiklik: {
    id: 'hasar-rapor-v526',
    title: 'Bu raporda ne değişti',
    body:
      'İş grubu seçilince listenin en altında kırmızı Yeni İş Kalemi Ekle durur. Sunulmuş, onay bekleyen ve dış onaydaki raporda revizyon açılır; taslakta açılmaz. Fotoğraf ileri-geri okları resmin yanındadır.',
  },
  musteriYetkiliAd: {
    id: 'musteri-yetkili-ad-v533',
    title: 'Yetkili kişi adı',
    body:
      'Bu kutuya yalnız kişi adı yazılır. Firma adı veya unvan parçası kaydı durdurur. Yazılım ad uydurmaz.',
  },
  acilListeSonDegisiklik: {
    id: 'acil-liste-v529',
    title: 'Bu sayfada ne değişti',
    body:
      'Liste Hasar kuyruğu gibidir. Ciro Sütunlar menüsündedir. Ödeme Durumu durur; gizlenemez. Sayfa altında kaç dosya göreceğinizi seçersiniz.',
  },
  acilDosyaSonDegisiklik: {
    id: 'acil-dosya-v523',
    title: 'Bu dosyada ne değişti',
    body:
      'Operasyon dijital onaylı servis formu olmadan ilerlemez. Anket kapandıktan sonra kapanış tercihlidir. Konum tespiti durur; tedarikçiye pin gider. Dört işlem saati kayıtlıdır. Resimler oturumla görünür.',
  },
  acilAsistansRaporOnay: {
    id: 'acil-asistans-rapor-onay-v596',
    title: 'Tespit raporu',
    body:
      'Çilingir dışında rapor Onay Talep adımında yazılır: tespit, resim, satış. Raporu İncele, sonra Asistansa Gönder. Onay gelen kutudan düşer. Çilingir eski yoldadır.',
  },
  sagPanelKaydir: {
    id: 'sag-panel-kaydir-v556',
    title: 'Sağ panel',
    body:
      'Soldaki sayfaya tıklayınca panel kapanmaz; sağa kayar. Başka sayfaya gitseniz şerit durur. Şeride tıklayınca yazdığınız durur. X veya Çıkış Yap deyince kayıt hatırlatması çıkar.',
  },
  haritaDosyaIsAdresi: {
    id: 'harita-bolge-il-v569',
    title: 'Harita',
    body:
      'Hasar ve Acil ayrı durur. Pin iş adresidir; il adı yeter, tedarikçi telefonu gerekmez. Tercihle kapanan dosya da durur. Üstte Bölge Seç. Yeşil kutu sahada iş. Daire personel telefonudur.',
  },
} as const;

export function opsNoticeStorageKey(noticeId: string): string {
  return `${OPS_FIRST_RUN_STORAGE_PREFIX}${noticeId}`;
}

export function isOpsNoticeDismissed(noticeId: string): boolean {
  if (typeof window === 'undefined') return true;
  try {
    return window.localStorage.getItem(opsNoticeStorageKey(noticeId)) === '1';
  } catch {
    return false;
  }
}

export function dismissOpsNotice(noticeId: string): void {
  try {
    window.localStorage.setItem(opsNoticeStorageKey(noticeId), '1');
  } catch {
    /* yoksay */
  }
}
