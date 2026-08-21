export type OperatorStepKey =
  | 'ihbar'
  | 'tedarikci_saha'
  | 'maliyet'
  | 'onay'
  | 'kapanis'
  | 'finans';

export type ApprovalState = 'bekliyor' | 'onaylandi' | 'reddedildi';

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
  },
): string | null {
  if (step === 'tedarikci_saha' && !s.assigned) return 'Tedarikçi atayın.';
  if (step === 'maliyet') {
    if (!s.assigned) return 'Önce tedarikçi atayın.';
    if (!s.alis.trim() || !s.satis.trim()) return 'Alış ve satış girin.';
  }
  if (step === 'onay') {
    if (!s.approvalText.trim()) return 'Onay metni girin.';
    if (s.approvalState === 'bekliyor') return 'Onayı kaydet veya red verin.';
  }
  if (step === 'kapanis') {
    if (!s.workStartOk) return 'Önce işe başlama işaretlensin.';
    if (!s.fileClosed) return 'Dosyayı kapatın.';
  }
  if (step === 'finans') {
    if (!s.fileClosed) return 'Önce dosyayı kapatın.';
    if (!s.financeSent) return 'Finansa aktarın.';
  }
  return null;
}
