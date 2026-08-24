/** Onarım raporu kalem tutarları — satış birim×miktar; maliyet girilen rakam (m² ile çarpılmaz). */

export type RepairItemTotalsInput = {
  pricingType?: string | null;
  lumpSumPrice?: number | null;
  quantity?: number | null;
  salesUnitPrice?: number | null;
  supplierUnitPrice?: number | null;
  supplierTotal?: number | null;
};

export function repairItemSalesTotal(item: RepairItemTotalsInput): number {
  if (item.pricingType === 'lumpsum') return Number(item.lumpSumPrice) || 0;
  return (Number(item.quantity) || 0) * (Number(item.salesUnitPrice) || 0);
}

/** Yeni kayıt: maliyet alanına girilen tutar (m² ile çarpılmaz). */
export function repairItemSupplierTotal(item: RepairItemTotalsInput): number {
  if (item.pricingType === 'lumpsum') return Number(item.lumpSumPrice) || 0;
  return Number(item.supplierUnitPrice) || 0;
}

/**
 * Eski formül miktar×maliyet yazmış ve sonuç satışın katı şişmişse düzelt.
 * Birim fiyatı gerçekten m² fiyatı olan kayıtlar (maliyet ≈ satış) dokunulmaz.
 */
export function repairItemSupplierNeedsHeal(item: RepairItemTotalsInput): boolean {
  if (item.pricingType === 'lumpsum') return false;
  const qty = Number(item.quantity) || 0;
  const unit = Number(item.supplierUnitPrice) || 0;
  const stored = Number(item.supplierTotal);
  if (!(qty > 1) || !(unit > 0) || !Number.isFinite(stored)) return false;
  const oldProduct = qty * unit;
  const next = repairItemSupplierTotal(item);
  if (Math.abs(stored - oldProduct) > 0.06 || Math.abs(stored - next) <= 0.06) return false;
  const sales = repairItemSalesTotal(item);
  if (sales > 0 && stored <= sales * 3) return false;
  return true;
}

export function repairItemResolvedSupplierTotal(item: RepairItemTotalsInput): number {
  if (item.pricingType === 'lumpsum') return Number(item.lumpSumPrice) || 0;
  if (repairItemSupplierNeedsHeal(item)) return repairItemSupplierTotal(item);
  const stored = Number(item.supplierTotal);
  if (Number.isFinite(stored) && stored > 0) return stored;
  return repairItemSupplierTotal(item);
}

export function repairItemMarginPct(item: RepairItemTotalsInput): number {
  const sales = repairItemSalesTotal(item);
  const cost = repairItemResolvedSupplierTotal(item);
  if (sales <= 0) return 0;
  return ((sales - cost) / sales) * 100;
}
