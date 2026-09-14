export type OperatorStepKey =
  | 'ihbar'
  | 'tedarikci_maliyet'
  | 'onay'
  | 'kapanis'
  | 'finans';

export type ApprovalState = 'bekliyor' | 'onaylandi' | 'reddedildi';

export const ACIL_ONAY_METIN_ON_EK = 'Riziko adreste;';

export function acilOnayMetinGovde(text: string): string {
  return (text || '').replace(/^Riziko adreste;[ ]?/i, '');
}

export function withAcilOnayMetinOnEk(text: string): string {
  const body = acilOnayMetinGovde(text);
  return `${ACIL_ONAY_METIN_ON_EK} ${body}`;
}

export function validateOperatorStep(
  step: OperatorStepKey,
  s: {
    assigned: string | null;
    alis: string;
    satis: string;
    workStartOk: boolean;
    fileClosed: boolean;
    financeSent: boolean;
    approvalState: ApprovalState;
    approvalText: string;
    digitalDocsOk?: boolean;
    addressRequestOk?: boolean;
    vendorPaid?: boolean | null;
    isLocksmith?: boolean;
    findingsText?: string;
    reportWorkGroup?: string;
    reportMahal?: string;
    reportJobDescription?: string;
    reportItemDescription?: string;
    photoCount?: number;
    approvalRequested?: boolean;
  },
): string | null {
  if (step === 'ihbar') {
    if (!s.addressRequestOk) return 'Adres Ve Hizmet Talep Onayı Alın.';
  }
  if (step === 'tedarikci_maliyet') {
    if (!s.assigned) return 'Tedarikçi Atayın.';
    if (!s.alis.trim() || !s.satis.trim()) return 'Alış Ve Satış Girin.';
  }
  if (step === 'onay') {
    if (s.isLocksmith === false) {
      if (!String(s.findingsText ?? '').trim()) return 'Tespit Bulgusu Yazın.';
      if ((s.photoCount ?? 0) < 1) return 'Tespit Resmi Ekleyin.';
      if (!String(s.reportWorkGroup ?? '').trim()) return 'İş Grubunu Yazın.';
      if (!String(s.reportMahal ?? '').trim()) return 'Mahal/Bölge Yazın.';
      if (!String(s.reportJobDescription ?? '').trim()) return 'İşin Tanımını Yazın.';
      if (!String(s.reportItemDescription ?? '').trim()) return 'Açıklamayı Yazın.';
      if (!s.approvalRequested) return 'Raporu Asistansa Gönderin.';
      if (s.approvalState === 'bekliyor') return 'Asistans Onayını Bekleyin.';
    } else {
      if (!acilOnayMetinGovde(s.approvalText).trim()) return 'Riziko Adreste Açıklamasını Yazın.';
      if (s.approvalState === 'bekliyor') return 'Onayı Kaydet Veya Red Verin.';
    }
  }
  if (step === 'kapanis') {
    if (s.approvalState !== 'onaylandi') return 'Önce Onay Talep Akışı Tamamlansın.';
    if (!s.digitalDocsOk) return 'Servis Onay Formu Dijital Onayı Olmadan Dosya Kapanmaz.';
    if (!s.fileClosed) return 'Dosyayı Kapatın.';
  }
  if (step === 'finans') {
    if (!s.fileClosed) return 'Önce Dosyayı Kapatın.';
    if (s.vendorPaid !== true && s.vendorPaid !== false) return 'Tedarikçi Ödemesini Ödendi Veya Ödenmedi Olarak Onaylayın.';
    if (!s.financeSent) return 'Finansa Aktarın.';
  }
  return null;
}

/** Alt Kaydet: raporu taslak kaydeder. Resim ve asistans gönderimi adım bitirme kapısındadır. */
export function validateOperatorDraftSave(
  step: OperatorStepKey,
  s: Parameters<typeof validateOperatorStep>[1],
): string | null {
  if (step === 'onay' && s.isLocksmith === false) {
    if (!String(s.findingsText ?? '').trim()) return 'Tespit Bulgusu Yazın.';
    if (!String(s.reportWorkGroup ?? '').trim()) return 'İş Grubunu Yazın.';
    if (!String(s.reportMahal ?? '').trim()) return 'Mahal/Bölge Yazın.';
    if (!String(s.reportJobDescription ?? '').trim()) return 'İşin Tanımını Yazın.';
    if (!String(s.reportItemDescription ?? '').trim()) return 'Açıklamayı Yazın.';
    return null;
  }
  if (step === 'kapanis') {
    return null;
  }
  return validateOperatorStep(step, s);
}

/** Sunum özeti adım değişince / yenilemede boş öneke dönmez. Gövde kırpılmaz. */
export function resolveAcilApprovalText(inMemory: string, stored: string): string {
  if (acilOnayMetinGovde(inMemory).trim()) return withAcilOnayMetinOnEk(inMemory);
  if (acilOnayMetinGovde(stored).trim()) return withAcilOnayMetinOnEk(stored);
  return withAcilOnayMetinOnEk(inMemory || stored || '');
}
