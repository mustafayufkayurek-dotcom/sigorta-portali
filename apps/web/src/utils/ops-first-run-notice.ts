/** Canlı operasyon değişikliği — personel iş ekranında bir kez görür. Kılavuz yetmez. */

export const OPS_FIRST_RUN_STORAGE_PREFIX = 'meridyen-ops-notice:';

export const OPS_NOTICE = {
  acilKayitliTedarikci: {
    id: 'acil-kayitli-tedarikci-v520',
    title: 'Tedarikçi Önerisi',
    body:
      'Üstte memnuniyet ve fiyat avantajı yüksek ilk 3 tedarikçi açık önerilir. Diğer kayıtlılar aynı listede kapalı kalır; açıp bakabilirsiniz. Olumsuz değerlendirmede yazılım uyarır; alternatif bakın. Aynı olumsuz tedarikçiyle 2. kez çalışılırsa yöneticiye e-posta gider.',
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
