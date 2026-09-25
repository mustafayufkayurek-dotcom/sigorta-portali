/** Onarım raporu kalem tutarları — satış ve birim maliyet miktar ile çarpılır. Satır tutarı gibi duran maliyet tekrar çarpılmaz. */

export type RepairItemTotalsInput = {
  pricingType?: string | null;
  lumpSumPrice?: number | null;
  quantity?: number | null;
  salesUnitPrice?: number | null;
  supplierUnitPrice?: number | null;
  supplierTotal?: number | null;
  salesTotal?: number | null;
  unit?: string | null;
};

function isCountQuantityUnit(unit?: string | null): boolean {
  const u = String(unit ?? '').trim().toLocaleLowerCase('tr-TR');
  if (!u) return false;
  if (/m[²³23]|m\s*\/?\s*t[uü]l|^metre$|^m²$|^m³$/.test(u)) return false;
  return /^(adet|takım|takim|kutu|torba|çuval|cuval|kamyon|servis|günlük|yevmiye|saat|asgari|tam gün|1\/2 gün)$/.test(u);
}

export function repairItemSalesTotal(item: RepairItemTotalsInput): number {
  if (item.pricingType === 'lumpsum') {
    const lump = money(item.lumpSumPrice);
    if (lump > 0) return lump;
    const storedLump = Number(item.salesTotal);
    return Number.isFinite(storedLump) && storedLump > 0 ? storedLump : lump;
  }
  const computed = money(item.quantity) * money(item.salesUnitPrice);
  if (computed > 0) return computed;
  const stored = Number(item.salesTotal);
  return Number.isFinite(stored) && stored > 0 ? stored : computed;
}

function money(n: number | string | null | undefined | { toNumber?: () => number }): number {
  if (n == null) return 0;
  if (typeof n === 'number') return Number.isFinite(n) ? n : 0;
  if (typeof n === 'object' && typeof n.toNumber === 'function') {
    return money(n.toNumber());
  }
  const v = Number(n);
  return Number.isFinite(v) ? v : 0;
}

/**
 * Kutu satır tutarıysa (eski şişme / götürü yazım) çarpılmaz.
 * Satış birimiyle aynı duran rakam birim maliyettir; miktar ile çarpılır.
 */
export function repairItemSupplierCellIsLineTotal(item: RepairItemTotalsInput): boolean {
  if (item.pricingType === 'lumpsum') return false;
  const qty = money(item.quantity);
  const cell = money(item.supplierUnitPrice);
  const salesUnit = money(item.salesUnitPrice);
  if (!(qty > 1) || !(cell > 0)) return false;
  if (salesUnit > 0 && cell > salesUnit * 3) return true;
  const salesLine = repairItemSalesTotal(item);
  if (salesLine > 0 && Math.abs(cell - salesLine) / salesLine <= 0.15) return true;
  // Adet vb.: maliyet kutusu satış birimiyle aynı, bedel miktar×satış — maliyet iş toplamıdır
  if (
    isCountQuantityUnit(item.unit)
    && salesUnit > 0
    && Math.abs(cell - salesUnit) <= 0.06
    && salesLine > cell + 0.06
  ) {
    return true;
  }
  return false;
}

/** Birim maliyet × miktar. Satır tutarı kutusu çarpılmaz. */
export function repairItemSupplierTotal(item: RepairItemTotalsInput): number {
  if (item.pricingType === 'lumpsum') return money(item.lumpSumPrice);
  const cell = money(item.supplierUnitPrice);
  if (!(cell > 0)) return 0;
  const qty = money(item.quantity);
  if (!(qty > 1) || repairItemSupplierCellIsLineTotal(item)) return cell;
  return qty * cell;
}

/**
 * Eski formül miktar×satır-tutarı yazmış ve sonuç satışın katı şişmişse düzelt.
 * Birim fiyatı gerçekten m² fiyatı olan kayıtlar dokunulmaz.
 */
export function repairItemSupplierNeedsHeal(item: RepairItemTotalsInput): boolean {
  if (item.pricingType === 'lumpsum') return false;
  const qty = money(item.quantity);
  const unit = money(item.supplierUnitPrice);
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
  const stored = Number(item.supplierTotal);
  if (item.pricingType === 'lumpsum') {
    if (Number.isFinite(stored) && stored > 0) return stored;
    return money(item.lumpSumPrice);
  }
  if (repairItemSupplierNeedsHeal(item)) {
    return money(item.supplierUnitPrice);
  }
  const computed = repairItemSupplierTotal(item);
  if (computed > 0) return computed;
  return Number.isFinite(stored) && stored > 0 ? stored : computed;
}

export function repairItemMarginPct(item: RepairItemTotalsInput): number {
  const sales = repairItemSalesTotal(item);
  const cost = repairItemResolvedSupplierTotal(item);
  if (sales <= 0) return 0;
  return ((sales - cost) / sales) * 100;
}
