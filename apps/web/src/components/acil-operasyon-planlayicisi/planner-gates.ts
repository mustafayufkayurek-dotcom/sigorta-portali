/** 28.08.2026 18:01 TR — packages/shared acil-digital-approval-pause ile aynı. */
const ACIL_DIGITAL_APPROVAL_RESUME_MS = Date.parse('2026-08-28T18:01:00+03:00');

function isAcilDigitalApprovalRequiredNow(): boolean {
  return Date.now() >= ACIL_DIGITAL_APPROVAL_RESUME_MS;
}

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
    vendorPaid?: boolean | null;
  },
): string | null {
  if (step === 'tedarikci_maliyet') {
    if (!s.assigned) return 'Tedarikçi atayın.';
    if (!s.alis.trim() || !s.satis.trim()) return 'Alış ve satış girin.';
  }
  if (step === 'onay') {
    if (!acilOnayMetinGovde(s.approvalText).trim()) return 'Riziko adreste açıklamasını yazın.';
    if (s.approvalState === 'bekliyor') return 'Onayı kaydet veya red verin.';
    if (isAcilDigitalApprovalRequiredNow() && s.digitalDocsOk === false) {
      return 'Servis onay formu dijital onayı olmadan ilerlenemez.';
    }
  }
  if (step === 'kapanis') {
    if (s.approvalState !== 'onaylandi') return 'Önce onay talep akışı tamamlansın.';
    if (!s.fileClosed) return 'Dosyayı kapatın.';
  }
  if (step === 'finans') {
    if (!s.fileClosed) return 'Önce dosyayı kapatın.';
    if (s.vendorPaid !== true && s.vendorPaid !== false) return 'Tedarikçi ödemesini ödendi veya ödenmedi olarak onaylayın.';
    if (!s.financeSent) return 'Finansa aktarın.';
  }
  return null;
}
