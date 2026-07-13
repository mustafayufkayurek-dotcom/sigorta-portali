/** Hasar dosyası üst band aşama şeridi (Mustafa onaylı sıra). */

export const CLAIM_FILE_STAGE_SLOTS = [
  { id: 'awaiting_approval', label: 'Onay Bekliyor' },
  { id: 'approved', label: 'Onaylandı' },
  { id: 'suppliers_assigned', label: 'Tedarikçiler Görevlendirildi' },
  { id: 'repair_in_progress', label: 'Onarım Aşamasında' },
  { id: 'repair_completed', label: 'Onarım Tamamlandı' },
] as const;

export type ClaimFileStageId = (typeof CLAIM_FILE_STAGE_SLOTS)[number]['id'];

export type ClaimFileStageTone = 'completed' | 'active' | 'future';

/** Rapor onaya gönderildi / onay bekliyor */
const REPORT_AWAITING = new Set([
  'submitted',
  'pending_approval',
]);

/** İç veya dış onay tamam */
const REPORT_APPROVED = new Set([
  'approved',
  'sent_for_external_approval',
  'externally_approved',
]);

/** Onarım devam ediyor (claim status) */
const CLAIM_REPAIR_IN_PROGRESS = new Set([
  'repair_planning',
  'repair_in_progress',
]);

/** Onarım bitti veya sonrası (claim status) */
const CLAIM_REPAIR_DONE = new Set([
  'repair_completed',
  'invoice_pending',
  'invoice_submitted',
  'payment_pending',
  'partially_collected',
  'closed',
  'completed',
]);

export type ClaimFileStageInput = {
  /** Onarım raporu status (draft, pending_approval, approved, …) */
  reportStatus?: string | null;
  /** ClaimFile.currentStatus.code */
  claimStatusCode?: string | null;
  /** En az bir tedarikçi atanmış mı */
  hasSuppliersAssigned?: boolean;
};

/**
 * Aktif aşama indeksi (0–4). Henüz onaya gönderilmediyse `null`
 * (tüm adımlar future). Sonraki adımlar önceki adımları tamamlanmış sayar.
 */
export function deriveClaimFileStageIndex(input: ClaimFileStageInput): number | null {
  const reportStatus = (input.reportStatus ?? '').trim().toLowerCase();
  const claimStatus = (input.claimStatusCode ?? '').trim().toLowerCase();
  const hasSuppliers = Boolean(input.hasSuppliersAssigned);

  if (CLAIM_REPAIR_DONE.has(claimStatus)) return 4;
  if (CLAIM_REPAIR_IN_PROGRESS.has(claimStatus)) return 3;
  if (hasSuppliers) return 2;
  if (REPORT_APPROVED.has(reportStatus)) return 1;
  if (REPORT_AWAITING.has(reportStatus)) return 0;
  return null;
}

export function claimFileStageTone(
  stageIndex: number,
  activeIndex: number | null,
): ClaimFileStageTone {
  if (activeIndex == null) return 'future';
  if (stageIndex < activeIndex) return 'completed';
  if (stageIndex === activeIndex) return 'active';
  return 'future';
}

export function hasClaimFileSuppliersAssigned(source: {
  assignedSupplierId?: string | null;
  assignedSupplier?: { id?: string } | null;
  assignedSuppliers?: Array<{ id?: string } | null> | null;
  supplierAssignments?: Array<{ vendorId?: string; vendor?: { id?: string } | null } | null> | null;
  supplierAssignedAt?: string | Date | null;
} | null | undefined): boolean {
  if (!source) return false;
  if (source.assignedSupplierId) return true;
  if (source.assignedSupplier?.id) return true;
  if (source.supplierAssignedAt) return true;
  if (Array.isArray(source.assignedSuppliers) && source.assignedSuppliers.some((s) => s?.id)) {
    return true;
  }
  if (
    Array.isArray(source.supplierAssignments) &&
    source.supplierAssignments.some((s) => s?.vendorId || s?.vendor?.id)
  ) {
    return true;
  }
  return false;
}
