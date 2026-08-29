import { repairItemResolvedSupplierTotal } from '@sigorta/shared';

export type HasarHakedisGrantDetail = {
  id?: string;
  jobDescription: string;
  quantity?: number;
  unit?: string;
  amount: number;
};

export type HasarHakedisGrantLine = {
  key: string;
  workGroupId?: string;
  label: string;
  amount: number;
  details: HasarHakedisGrantDetail[];
  ornek?: boolean;
};

export const ORNEK_HAKEDIS_TOPLAM = 12_500;

/** Raporda kalem yoksa gösterilen iş grubu örneği (Mobilya / Sıva). */
export function buildOrnekHasarHakedisLines(toplam: number): HasarHakedisGrantLine[] {
  const base = toplam > 0 ? toplam : ORNEK_HAKEDIS_TOPLAM;
  const mobilya = Math.round(base * 0.6);
  const siva = base - mobilya;
  return [
    {
      key: 'ornek-mobilya',
      label: 'Mobilya İşleri',
      amount: mobilya,
      ornek: true,
      details: [{
        jobDescription: 'Koltuk döşeme',
        quantity: 1,
        unit: 'adet',
        amount: mobilya,
      }],
    },
    {
      key: 'ornek-siva',
      label: 'Sıva İşleri',
      amount: siva,
      ornek: true,
      details: [{
        jobDescription: 'Duvar sıva tamiri',
        quantity: 1,
        unit: 'm2',
        amount: siva,
      }],
    },
  ];
}

type ReportItem = {
  id?: string;
  workGroupId?: string;
  workGroup?: { id?: string; name?: string };
  jobDescription?: string;
  description?: string;
  unit?: string;
  pricingType?: string | null;
  lumpSumPrice?: number | null;
  quantity?: number | null;
  supplierUnitPrice?: number | null;
  supplierTotal?: number | null;
};

type BudgetItem = {
  category?: string | null;
  description?: string | null;
  quantity?: number | null;
  unitPrice?: number | null;
  unit?: string | null;
  vendorId?: string | null;
};

/** Rapordaki iş grubu adı — «Mobilya» → «Mobilya İşleri». */
export function workGroupJobsLabel(name?: string | null): string {
  const t = String(name ?? '').trim().replace(/\s*iş grubu$/giu, '').trim();
  if (!t) return 'İş Grubu';
  const lower = t.toLocaleLowerCase('tr-TR');
  if (lower.endsWith('işleri')) return t;
  return `${t} İşleri`;
}

/** Tedarikçi maliyeti iş grubu bazında; kalem detayı rapordan. */
export function buildHasarHakedisGrantLines(source: {
  reportItems?: ReportItem[] | null;
  reportSupplierTotal?: number | null;
  budgetItems?: BudgetItem[] | null;
  fileSupplierCost?: number | null;
}): HasarHakedisGrantLine[] {
  const grouped = new Map<string, HasarHakedisGrantLine>();
  for (const item of source.reportItems ?? []) {
    const add = repairItemResolvedSupplierTotal(item);
    if (!(add > 0)) continue;
    const wgId = item.workGroupId ?? item.workGroup?.id ?? '__diger__';
    const label = workGroupJobsLabel(item.workGroup?.name);
    const prev = grouped.get(wgId) ?? {
      key: wgId,
      workGroupId: item.workGroupId ?? item.workGroup?.id,
      label,
      amount: 0,
      details: [],
    };
    prev.amount += add;
    prev.details.push({
      id: item.id,
      jobDescription: item.jobDescription || item.description || 'İş kalemi',
      quantity: item.quantity ?? undefined,
      unit: item.unit ?? undefined,
      amount: add,
    });
    grouped.set(wgId, prev);
  }
  const fromItems = Array.from(grouped.values());
  if (fromItems.length > 0) return fromItems;

  const byCategory = new Map<string, HasarHakedisGrantLine>();
  for (const item of source.budgetItems ?? []) {
    const qty = Number(item.quantity) || 1;
    const price = Number(item.unitPrice) || 0;
    const add = qty * price;
    if (!(add > 0)) continue;
    const label = workGroupJobsLabel(item.category);
    const key = label.toLocaleLowerCase('tr-TR');
    const prev = byCategory.get(key) ?? {
      key,
      label,
      amount: 0,
      details: [],
    };
    prev.amount += add;
    prev.details.push({
      jobDescription: item.description || label,
      quantity: qty,
      unit: item.unit ?? undefined,
      amount: add,
    });
    byCategory.set(key, prev);
  }
  const fromBudget = Array.from(byCategory.values());
  if (fromBudget.length > 0) return fromBudget;

  const fallback = [
    Number(source.reportSupplierTotal) || 0,
    Number(source.fileSupplierCost) || 0,
  ].find((n) => n > 0);
  if (fallback && fallback > 0) {
    return [{
      key: 'tedarikci-butce',
      label: 'Tedarikçi bütçesi',
      amount: fallback,
      details: [],
    }];
  }
  return [];
}
