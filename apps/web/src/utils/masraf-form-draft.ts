/** Masraf formu — Tedarikçiler’e gidince taslak; dönüşte geri yazılır. */

export const MASRAF_FORM_DRAFT_KEY = 'meridyen:masraf-form-draft';
export const CLAIM_FILE_EXPENSE_DRAFT_KEY = 'meridyen:claim-file-expense-draft';

export type MasrafFormDraftPayload = {
  v: 1;
  form: Record<string, unknown>;
  kalemSatirlari?: unknown[];
  fileSearch?: string;
  savedAt: number;
};

export type ClaimFileExpenseDraftPayload = {
  v: 1;
  claimFileId: string;
  expensePlan: string;
  expenseCategoryParentId: string;
  expenseCategoryId: string;
  partyAccountId: string;
  description: string;
  documentType: string;
  documentOwner?: string;
  documentNo: string;
  amount: string;
  vatRate: string;
  date: string;
  receiptImageUrl: string;
  savedAt: number;
};

function canUseSession(): boolean {
  return typeof window !== 'undefined' && typeof window.sessionStorage !== 'undefined';
}

export function saveMasrafFormDraft(draft: Omit<MasrafFormDraftPayload, 'v' | 'savedAt'>): void {
  if (!canUseSession()) return;
  try {
    const payload: MasrafFormDraftPayload = {
      v: 1,
      form: draft.form,
      kalemSatirlari: draft.kalemSatirlari,
      fileSearch: draft.fileSearch,
      savedAt: Date.now(),
    };
    window.sessionStorage.setItem(MASRAF_FORM_DRAFT_KEY, JSON.stringify(payload));
  } catch {
    /* kota / gizli mod */
  }
}

export function takeMasrafFormDraft(): MasrafFormDraftPayload | null {
  if (!canUseSession()) return null;
  try {
    const raw = window.sessionStorage.getItem(MASRAF_FORM_DRAFT_KEY);
    window.sessionStorage.removeItem(MASRAF_FORM_DRAFT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as MasrafFormDraftPayload;
    if (parsed?.v !== 1 || !parsed.form || typeof parsed.form !== 'object') return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveClaimFileExpenseDraft(
  draft: Omit<ClaimFileExpenseDraftPayload, 'v' | 'savedAt'>,
): void {
  if (!canUseSession() || !draft.claimFileId.trim()) return;
  try {
    const payload: ClaimFileExpenseDraftPayload = {
      ...draft,
      v: 1,
      savedAt: Date.now(),
    };
    window.sessionStorage.setItem(CLAIM_FILE_EXPENSE_DRAFT_KEY, JSON.stringify(payload));
  } catch {
    /* ignore */
  }
}

export function takeClaimFileExpenseDraft(
  claimFileId: string,
): ClaimFileExpenseDraftPayload | null {
  if (!canUseSession()) return null;
  try {
    const raw = window.sessionStorage.getItem(CLAIM_FILE_EXPENSE_DRAFT_KEY);
    window.sessionStorage.removeItem(CLAIM_FILE_EXPENSE_DRAFT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ClaimFileExpenseDraftPayload;
    if (parsed?.v !== 1 || parsed.claimFileId !== claimFileId) return null;
    return parsed;
  } catch {
    return null;
  }
}
