/**
 * Hasar listesi / kart — atanmış tedarikçi görünen adı.
 * Eksper (assignedAdjuster) tedarikçi değildir; yanlış alan okunursa «Atanmadı» kalır.
 */

type SupplierLike = { id?: string; name?: string | null; companyName?: string | null };

export function resolveClaimSupplierDisplayName(claim: {
  assignedSupplier?: SupplierLike | null;
  assignedSuppliers?: SupplierLike[] | null;
  supplierAssignments?: Array<{ vendor?: SupplierLike | null }> | null;
}): string | null {
  if (Array.isArray(claim.assignedSuppliers) && claim.assignedSuppliers.length > 0) {
    const names = claim.assignedSuppliers
      .map((s) => (s.name ?? s.companyName ?? '').trim())
      .filter(Boolean);
    if (names.length) return names.join(' · ');
  }

  if (Array.isArray(claim.supplierAssignments) && claim.supplierAssignments.length > 0) {
    const names = claim.supplierAssignments
      .map((row) => (row.vendor?.name ?? row.vendor?.companyName ?? '').trim())
      .filter(Boolean);
    if (names.length) return names.join(' · ');
  }

  const primary = (claim.assignedSupplier?.name ?? claim.assignedSupplier?.companyName ?? '').trim();
  return primary || null;
}
