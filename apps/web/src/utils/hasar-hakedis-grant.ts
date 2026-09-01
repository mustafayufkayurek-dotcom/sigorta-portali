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

/** Eski örnek satır sızarsa finansa gitmez. Canlı listeye örnek basılmaz. */
export function isOrnekHakedisSatiri(row: { key?: string; vendorId?: string }): boolean {
  return String(row.key ?? '').startsWith('ornek-')
    || String(row.vendorId ?? '').startsWith('ornek-');
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

export const DOSYA_ODEME_TEDARIKCI_YOK = 'Tedarikçi Yok';
export const DOSYA_ODEME_IS_GRUBU_YOK = 'İş Grubu Yok';

function isUydurmaIsGrubu(name: string): boolean {
  const lower = name.toLocaleLowerCase('tr-TR');
  return lower === 'tedarikçi bütçesi'
    || lower === 'iş grubu'
    || lower === 'iş grubu yok'
    || lower === 'tedarikçi yok';
}

function tekGercekEtiket(names: Array<string | null | undefined>): string | null {
  const unique = [...new Set(
    names
      .map((name) => String(name ?? '').trim())
      .filter((name) => name && !isUydurmaIsGrubu(name))
      .map((name) => workGroupJobsLabel(name)),
  )];
  return unique.length === 1 ? unique[0]! : null;
}

/** Dosya hareketinde tedarikçi adı boş bırakılmaz. */
export function dosyaOdemeTedarikciAdi(source: {
  vendorName?: string | null;
  supplierName?: string | null;
  fallbackName?: string | null;
}): string {
  const name = String(source.vendorName ?? '').trim()
    || String(source.supplierName ?? '').trim()
    || String(source.fallbackName ?? '').trim();
  return name || DOSYA_ODEME_TEDARIKCI_YOK;
}

/** Dosya hareketinde iş grubu. Uydurma «Tedarikçi bütçesi» yazılmaz. */
export function dosyaOdemeIsGrubu(source: {
  lineDescription?: string | null;
  workGroupName?: string | null;
  supplierWorkGroups?: Array<{ name?: string | null }>;
  grantLabels?: Array<string | null | undefined>;
  statementLabels?: Array<string | null | undefined>;
}): string {
  const fromLine = tekGercekEtiket([source.lineDescription]);
  if (fromLine) return fromLine;
  const fromWg = tekGercekEtiket([source.workGroupName]);
  if (fromWg) return fromWg;
  const fromSupplier = tekGercekEtiket((source.supplierWorkGroups ?? []).map((item) => item.name));
  if (fromSupplier) return fromSupplier;
  const fromStatement = tekGercekEtiket(source.statementLabels ?? []);
  if (fromStatement) return fromStatement;
  const fromGrant = tekGercekEtiket(source.grantLabels ?? []);
  if (fromGrant) return fromGrant;
  return DOSYA_ODEME_IS_GRUBU_YOK;
}

/** Rapordaki iş grubu adı — «Mobilya» → «Mobilya İşleri». */
export function workGroupJobsLabel(name?: string | null): string {
  const t = String(name ?? '').trim().replace(/\s*iş grubu$/giu, '').trim();
  if (!t) return 'İş Grubu';
  const lower = t.toLocaleLowerCase('tr-TR');
  if (lower === 'iş grubu yok') return DOSYA_ODEME_IS_GRUBU_YOK;
  if (lower.endsWith('işleri')) return t;
  return `${t} İşleri`;
}

/** Kayıt metninden «İş Grubu Yok» düşer; iş grubu adı kutu doldurmaz. */
export function avansAciklamaMetni(value?: string | null): string {
  const t = String(value ?? '').trim();
  if (!t) return '';
  if (t === DOSYA_ODEME_IS_GRUBU_YOK) return '';
  if (t.toLocaleLowerCase('tr-TR') === 'iş grubu yok') return '';
  return t;
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

export type HasarHakedisSecimSatiri = {
  key: string;
  workGroupId?: string;
  workGroupLabel: string;
  vendorId: string;
  vendorName: string;
  paymentDueDays: number | null;
  amount: number;
};

export type HasarHakedisSecimTedarikci = {
  id: string;
  name: string;
  paymentDueDays?: number | null;
  workGroups?: Array<{ id: string; name: string }>;
};

/** Katalog yığını (boş tedarikçiye basılan tüm gruplar) iş grubu sayılmaz. */
export function gercekTedarikciIsGruplari(
  supplier: HasarHakedisSecimTedarikci,
  catalogIds: string[] = [],
): Array<{ id: string; name: string }> {
  const groups = supplier.workGroups ?? [];
  if (groups.length === 0) return [];
  const cat = new Set(catalogIds.filter(Boolean));
  if (cat.size > 0 && groups.length >= cat.size && groups.every((g) => cat.has(g.id))) {
    return [];
  }
  return groups;
}

/** Bütçe − ödenen avans − verilen hakediş = kalan hakediş. */
export function hasarHakedisKalan(butce: number, odenenAvans: number, verilenHakedis = 0): number {
  return Math.round(Math.max(0, butce - odenenAvans - verilenHakedis) * 100) / 100;
}

function isGrubuEtiketKey(name?: string | null): string {
  return workGroupJobsLabel(name).toLocaleLowerCase('tr-TR');
}

export type HasarHakedisVerilenKalem = {
  workGroupId?: string | null;
  lineDescription?: string | null;
  workGroup?: { name?: string | null } | null;
  totalAmount?: number | null;
};

export type HasarHakedisVerilenKaynak = {
  vendorId?: string;
  vendor?: { id?: string };
  status?: string;
  totalAmount?: number | null;
  items?: HasarHakedisVerilenKalem[];
};

function satirIsGrubuEslesir(
  item: HasarHakedisVerilenKalem,
  satir: { workGroupId?: string; workGroupLabel?: string },
): boolean {
  if (satir.workGroupId && item.workGroupId && item.workGroupId === satir.workGroupId) return true;
  const want = isGrubuEtiketKey(satir.workGroupLabel);
  if (!want || want === 'iş grubu' || want === isGrubuEtiketKey(DOSYA_ODEME_IS_GRUBU_YOK)) return false;
  const got = isGrubuEtiketKey(item.lineDescription || item.workGroup?.name);
  return Boolean(got && got === want);
}

/**
 * Verilen hakediş iş grubuna yazılır. Aynı tedarikçinin diğer kalemi
 * bu satırın kalanını sıfırlamaz.
 */
export function verilenHakedisForSatir(source: {
  vendorId: string;
  workGroupId?: string;
  workGroupLabel?: string;
  statements?: HasarHakedisVerilenKaynak[];
  payments?: Array<{ payerId?: string | null; amount?: number; skip?: boolean }>;
  vendorSatirSayisi?: number;
}): number {
  const vendorId = source.vendorId;
  if (!vendorId) return 0;
  let fromItems = 0;
  let vendorHasStatement = false;
  for (const row of source.statements ?? []) {
    const id = row.vendorId || row.vendor?.id;
    if (id !== vendorId) continue;
    if (String(row.status ?? '').toLowerCase() === 'cancelled') continue;
    vendorHasStatement = true;
    const items = row.items ?? [];
    const matched = items.filter((item) => satirIsGrubuEslesir(item, source));
    if (matched.length === 0) {
      if (items.length === 0 && (source.vendorSatirSayisi ?? 1) <= 1) {
        fromItems += Number(row.totalAmount) || 0;
      }
      continue;
    }
    const matchedSum = matched.reduce((sum, item) => sum + (Number(item.totalAmount) || 0), 0);
    if (matchedSum > 0) {
      fromItems += matchedSum;
      continue;
    }
    const onlyThisLine = items.length === 1 || matched.length === items.length;
    if (onlyThisLine) fromItems += Number(row.totalAmount) || 0;
  }
  if (fromItems > 0) return Math.round(fromItems * 100) / 100;
  if (vendorHasStatement) return 0;
  if ((source.vendorSatirSayisi ?? 1) > 1) return 0;
  let fromPayments = 0;
  for (const row of source.payments ?? []) {
    if (row.payerId !== vendorId) continue;
    if (row.skip) continue;
    fromPayments += Number(row.amount ?? 0);
  }
  return Math.round(fromPayments * 100) / 100;
}

/** Avans tedarikçi üzerinedir; iş grubu satırına bütçe payıyla yazılır. */
export function avansPayiForSatir(lineAmount: number, vendorLineTotal: number, vendorAvans: number): number {
  if (!(vendorAvans > 0) || !(lineAmount > 0) || !(vendorLineTotal > 0)) return 0;
  if (vendorLineTotal <= lineAmount + 0.009) return Math.round(vendorAvans * 100) / 100;
  return Math.round(((vendorAvans * lineAmount) / vendorLineTotal) * 100) / 100;
}

/** Bütçe düzenlenince kalem payları yeni tutara ölçeklenir. */
export function scaleGrantDetailsToAmount(
  details: HasarHakedisGrantDetail[],
  nextAmount: number,
): HasarHakedisGrantDetail[] {
  const next = Math.round(Math.max(0, nextAmount) * 100) / 100;
  if (details.length === 0) return details;
  const prev = details.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
  if (!(prev > 0)) {
    const head = details[0];
    if (!head) return details;
    return [{ ...head, amount: next }, ...details.slice(1).map((item) => ({ ...item, amount: 0 }))];
  }
  const scaled = details.map((item) => ({
    ...item,
    amount: Math.round(((Number(item.amount) || 0) / prev) * next * 100) / 100,
  }));
  const drift = Math.round((next - scaled.reduce((sum, item) => sum + item.amount, 0)) * 100) / 100;
  if (scaled[0]) {
    scaled[0] = { ...scaled[0], amount: Math.round((scaled[0].amount + drift) * 100) / 100 };
  }
  return scaled;
}

export function isHasarHakedisSatiriPasif(source: {
  vendorId: string;
  workGroupId?: string;
  kalanHakedis?: number;
  statements?: Array<{
    vendorId?: string;
    vendor?: { id?: string };
    status?: string;
    items?: Array<{ workGroupId?: string | null }>;
  }>;
  hakedisGonderildiVendorIds?: string[];
}): boolean {
  if (source.kalanHakedis != null) return source.kalanHakedis <= 0;
  const vendorId = source.vendorId;
  if (!vendorId) return false;
  if ((source.hakedisGonderildiVendorIds ?? []).includes(vendorId)) return true;
  for (const row of source.statements ?? []) {
    const id = row.vendorId || row.vendor?.id;
    if (id !== vendorId) continue;
    if (String(row.status ?? '').toLowerCase() === 'cancelled') continue;
    const itemGroups = (row.items ?? []).map((item) => item.workGroupId).filter(Boolean) as string[];
    if (source.workGroupId && itemGroups.length > 0) {
      if (itemGroups.includes(source.workGroupId)) return true;
      continue;
    }
    return true;
  }
  return false;
}

function lineForWorkGroup(lines: HasarHakedisGrantLine[], workGroupId: string, workGroupName: string): HasarHakedisGrantLine | null {
  const byId = lines.find((line) => line.workGroupId === workGroupId && line.amount > 0);
  if (byId) return byId;
  const want = workGroupJobsLabel(workGroupName).toLocaleLowerCase('tr-TR');
  return lines.find((line) => line.label.toLocaleLowerCase('tr-TR') === want && line.amount > 0) ?? null;
}

/** Dosya tedarikçisi × iş grubu. «Tedarikçi bütçesi» iş grubu değildir. */
export function buildHasarHakedisSecimSatirlari(source: {
  lines: HasarHakedisGrantLine[];
  suppliers: HasarHakedisSecimTedarikci[];
  catalogWorkGroupIds?: string[];
}): HasarHakedisSecimSatiri[] {
  const suppliers = source.suppliers.filter((row) => row.id);
  if (suppliers.length === 0) return [];
  const catalogIds = source.catalogWorkGroupIds ?? [];
  const fallback = source.lines.find((line) => !line.workGroupId && line.amount > 0) ?? null;
  const rows: HasarHakedisSecimSatiri[] = [];
  for (const supplier of suppliers) {
    const real = gercekTedarikciIsGruplari(supplier, catalogIds);
    if (real.length === 0) {
      const groupLines = source.lines.filter((line) => line.workGroupId && line.amount > 0);
      if (groupLines.length > 0) {
        for (const line of groupLines) {
          rows.push({
            key: `${supplier.id}:${line.key}`,
            workGroupId: line.workGroupId,
            workGroupLabel: line.label,
            vendorId: supplier.id,
            vendorName: supplier.name,
            paymentDueDays: supplier.paymentDueDays ?? null,
            amount: line.amount,
          });
        }
        continue;
      }
      const amount = fallback?.amount
        ?? source.lines.filter((line) => line.amount > 0).reduce((s, line) => s + line.amount, 0);
      if (!(amount > 0)) continue;
      rows.push({
        key: `${supplier.id}:is-grubu-yok`,
        workGroupLabel: 'İş Grubu Yok',
        vendorId: supplier.id,
        vendorName: supplier.name,
        paymentDueDays: supplier.paymentDueDays ?? null,
        amount,
      });
      continue;
    }
    for (const group of real) {
      const matched = lineForWorkGroup(source.lines, group.id, group.name);
      const amount = matched?.amount ?? (real.length === 1 ? (fallback?.amount ?? 0) : 0);
      if (!(amount > 0)) continue;
      rows.push({
        key: `${supplier.id}:${group.id}`,
        workGroupId: group.id,
        workGroupLabel: workGroupJobsLabel(group.name),
        vendorId: supplier.id,
        vendorName: supplier.name,
        paymentDueDays: supplier.paymentDueDays ?? null,
        amount,
      });
    }
  }
  return rows;
}
