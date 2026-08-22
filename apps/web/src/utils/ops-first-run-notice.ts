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
    id: 'hasar-liste-v527',
    title: 'Bu sayfada ne değişti',
    body:
      '72 saat aşan satır kırmızı yanıp söner. Fazla sütun Sütunlar menüsündedir.',
  },
  hasarDosyaSonDegisiklik: {
    id: 'hasar-dosya-v526',
    title: 'Bu dosyada ne değişti',
    body:
      'Tespit resmi ve not Raporlar içindedir. Düzenle Raporlar’ı açar. Durum rozeti üst banttadır. Resimler oturumla görünür; kutu dosya adı göstermez.',
  },
  hasarRaporSonDegisiklik: {
    id: 'hasar-rapor-v526',
    title: 'Bu raporda ne değişti',
    body:
      'İş grubu seçilince listenin en altında kırmızı Yeni İş Kalemi Ekle durur. Sunulmuş, onay bekleyen ve dış onaydaki raporda revizyon açılır; taslakta açılmaz. Fotoğraf ileri-geri okları resmin yanındadır.',
  },
  acilListeSonDegisiklik: {
    id: 'acil-liste-v527',
    title: 'Bu sayfada ne değişti',
    body:
      'Ödeme Durumu durur; gizlenemez. 72 saat aşan satır kırmızı yanıp söner. Ciro Sütunlar menüsündedir.',
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
