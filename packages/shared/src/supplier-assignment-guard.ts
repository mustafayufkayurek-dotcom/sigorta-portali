/** Hasar: tespitçi olan tedarikçi olamaz; aynı tedarikçi ikinci kez atanmaz. */

export const SUPPLIER_ALREADY_ASSIGNED_MESSAGE =
  'Bu tedarikçi bu dosyaya zaten atanmış.';

export const INSPECTOR_CANNOT_BE_SUPPLIER_MESSAGE =
  'Tespitçi olan tedarikçi olamaz. Bu kişi dosyada tespitçi olarak atanmış.';

export const SUPPLIER_CANNOT_BE_INSPECTOR_MESSAGE =
  'Tespitçi olan tedarikçi olamaz. Bu kişi dosyada tedarikçi olarak atanmış.';

export type SupplierAssignConflictReason = 'already_supplier' | 'already_inspector';

export type SupplierAssignConflict = {
  vendorId: string;
  reason: SupplierAssignConflictReason;
};

export function supplierAssignConflicts(input: {
  vendorIds: string[];
  existingSupplierIds: Iterable<string>;
  inspectorVendorId?: string | null;
}): SupplierAssignConflict[] {
  const existing = new Set(
    [...input.existingSupplierIds].map((id) => String(id ?? '').trim()).filter(Boolean),
  );
  const inspector = String(input.inspectorVendorId ?? '').trim();
  const seen = new Set<string>();
  const out: SupplierAssignConflict[] = [];
  for (const raw of input.vendorIds) {
    const id = String(raw ?? '').trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    if (inspector && id === inspector) {
      out.push({ vendorId: id, reason: 'already_inspector' });
      continue;
    }
    if (existing.has(id)) {
      out.push({ vendorId: id, reason: 'already_supplier' });
    }
  }
  return out;
}

export function supplierAssignConflictMessage(conflicts: SupplierAssignConflict[]): string {
  if (conflicts.some((c) => c.reason === 'already_inspector')) {
    return INSPECTOR_CANNOT_BE_SUPPLIER_MESSAGE;
  }
  if (conflicts.length > 0) return SUPPLIER_ALREADY_ASSIGNED_MESSAGE;
  return '';
}

export function isSupplierAlreadyOnFile(input: {
  vendorId: string;
  existingSupplierIds: Iterable<string>;
  inspectorVendorId?: string | null;
}): boolean {
  return supplierAssignConflicts({
    vendorIds: [input.vendorId],
    existingSupplierIds: input.existingSupplierIds,
    inspectorVendorId: input.inspectorVendorId,
  }).length > 0;
}
