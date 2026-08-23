/** Canlı operasyon değişikliği — personel iş ekranında bir kez görür. Kılavuz yetmez. */

export const OPS_FIRST_RUN_STORAGE_PREFIX = 'meridyen-ops-notice:';

export const OPS_NOTICE = {
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
      'Acil Yardım vekaleti olan finans personeli de bu listede görünür. Dosyayı ona atayabilirsiniz.',
  },
  acilTedarikciHakedis: {
    id: 'acil-tedarikci-hakedis-v524',
    title: 'Tedarikçi Hakedişi',
    body:
      'İş bitince bu dosyanın tedarikçisine hakediş verilir. Verilme tarih ve saati kayıttadır. Finans ekranına düşer. Acil tedarikçisine vade uygulanmaz.',
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
