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
