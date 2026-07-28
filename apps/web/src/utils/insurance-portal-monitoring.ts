/** Sigorta portalı — dosya portföy sınıflandırması (operasyon dili). */

const CLOSED_CODES = new Set(['closed', 'cancelled', 'completed']);
const INVOICING_CODES = new Set([
  'repair_completed',
  'invoice_pending',
  'invoice_submitted',
  'payment_pending',
  'partially_collected',
]);
const AWAITING_APPROVAL_CODES = new Set(['budget_submitted']);
const TESPIT_CODES = new Set([
  'new',
  'pre_review',
  'adjuster_assigned',
  'site_visit_planned',
  'site_visit_done',
]);
const REPAIR_PROCESS_CODES = new Set([
  'budget_approved',
  'repair_in_progress',
  'parts_ordered',
  'supplier_assigned',
  'work_order_issued',
  ...INVOICING_CODES,
]);

export type InsuranceClaimLike = {
  id: string;
  fileNumber?: string;
  fileNo?: string;
  updatedAt?: string;
  lastActivityAt?: string | null;
  createdAt?: string;
  sourceChannel?: string | null;
  notificationDate?: string | null;
  currentStatus?: { code?: string; name?: string; colorCode?: string; color?: string } | null;
  assignedFieldUser?: { firstName?: string; lastName?: string } | null;
  assignedAdjuster?: {
    id?: string;
    firstName?: string;
    lastName?: string;
    adjuster?: { name?: string | null; company?: string | null } | null;
  } | null;
  propertyAddress?: { city?: string | null; district?: string | null } | null;
  city?: string | null;
  subject?: string;
  lossType?: string;
  productBranch?: string | null;
  claimSubject?: { id?: string; name?: string | null } | null;
};

export type InsuranceChartPreference = 'total' | 'expert_monitor' | 'direct_process';

export function filesForInsuranceChartPreference(
  files: InsuranceClaimLike[],
  preference: InsuranceChartPreference,
): InsuranceClaimLike[] {
  if (preference === 'total') return files;
  return files.filter((f) => classifyInsuranceFileTrack(f) === preference);
}

export function insuranceCityOf(file: InsuranceClaimLike): string {
  const raw = (file.propertyAddress?.city || file.city || '').trim();
  if (!raw || /^belirtilmemi[sş]$/i.test(raw)) return 'Belirtilmemiş';
  return raw;
}

export type InsuranceProvinceStat = {
  city: string;
  total: number;
  open: number;
  tespit: number;
  awaitingApproval: number;
  repair: number;
};

export type InsuranceNamedCountStat = {
  label: string;
  total: number;
  open: number;
  repair: number;
};

/** Türkiye geneli il bazlı sonuç özeti (seçili dosya kümesi). */
export function buildInsuranceProvinceStats(files: InsuranceClaimLike[]): InsuranceProvinceStat[] {
  const map = new Map<string, InsuranceProvinceStat>();
  for (const file of files) {
    const city = insuranceCityOf(file);
    const key = city.toLocaleLowerCase('tr-TR');
    const row = map.get(key) ?? {
      city,
      total: 0,
      open: 0,
      tespit: 0,
      awaitingApproval: 0,
      repair: 0,
    };
    row.total += 1;
    const bucket = classifyInsuranceMonitoringFile(file);
    if (bucket !== 'closed') row.open += 1;
    if (bucket === 'tespit') row.tespit += 1;
    if (bucket === 'awaiting_approval') row.awaitingApproval += 1;
    if (bucket === 'invoicing' || isInsuranceRepairProcess(file)) row.repair += 1;
    map.set(key, row);
  }
  return [...map.values()].sort((a, b) => b.total - a.total || a.city.localeCompare(b.city, 'tr'));
}

export function insuranceBranchOf(file: InsuranceClaimLike): string {
  const branch = (file.productBranch || '').trim();
  if (branch && !/^belirtilmem/i.test(branch) && !/^diger$/i.test(branch)) return branch;
  return insuranceSubjectOf(file);
}

export function insuranceExpertOf(file: InsuranceClaimLike): string {
  const a = file.assignedAdjuster;
  if (!a) return 'Atanmamış';
  const person = `${a.firstName ?? ''} ${a.lastName ?? ''}`.trim();
  if (person) return person;
  const office = (a.adjuster?.name || a.adjuster?.company || '').trim();
  if (office) return office;
  return 'Atanmamış';
}

function bumpNamedCount(
  map: Map<string, InsuranceNamedCountStat>,
  label: string,
  file: InsuranceClaimLike,
) {
  const key = label.toLocaleLowerCase('tr-TR');
  const row = map.get(key) ?? { label, total: 0, open: 0, repair: 0 };
  row.total += 1;
  const bucket = classifyInsuranceMonitoringFile(file);
  if (bucket !== 'closed') row.open += 1;
  if (bucket === 'invoicing' || isInsuranceRepairProcess(file)) row.repair += 1;
  map.set(key, row);
}

/** Branş (ürün / konu) bazlı dağılım */
export function buildInsuranceBranchStats(files: InsuranceClaimLike[]): InsuranceNamedCountStat[] {
  const map = new Map<string, InsuranceNamedCountStat>();
  for (const file of files) bumpNamedCount(map, insuranceBranchOf(file), file);
  return [...map.values()].sort((a, b) => b.total - a.total || a.label.localeCompare(b.label, 'tr'));
}

/** Eksper bazlı dağılım */
export function buildInsuranceExpertStats(files: InsuranceClaimLike[]): InsuranceNamedCountStat[] {
  const map = new Map<string, InsuranceNamedCountStat>();
  for (const file of files) bumpNamedCount(map, insuranceExpertOf(file), file);
  return [...map.values()].sort((a, b) => b.total - a.total || a.label.localeCompare(b.label, 'tr'));
}

/** Açık dosyalar — il bazlı */
export function buildInsuranceOpenByCityStats(files: InsuranceClaimLike[]): InsuranceNamedCountStat[] {
  const open = files.filter((f) => classifyInsuranceMonitoringFile(f) !== 'closed');
  const map = new Map<string, InsuranceNamedCountStat>();
  for (const file of open) bumpNamedCount(map, insuranceCityOf(file), file);
  return [...map.values()].sort((a, b) => b.total - a.total || a.label.localeCompare(b.label, 'tr'));
}

/** Açık dosyalar — eksper bazlı */
export function buildInsuranceOpenByExpertStats(files: InsuranceClaimLike[]): InsuranceNamedCountStat[] {
  const open = files.filter((f) => classifyInsuranceMonitoringFile(f) !== 'closed');
  const map = new Map<string, InsuranceNamedCountStat>();
  for (const file of open) bumpNamedCount(map, insuranceExpertOf(file), file);
  return [...map.values()].sort((a, b) => b.total - a.total || a.label.localeCompare(b.label, 'tr'));
}

/** Onarım aşamasındaki dosyalar — il bazlı */
export function buildInsuranceRepairByCityStats(files: InsuranceClaimLike[]): InsuranceNamedCountStat[] {
  const repair = files.filter(
    (f) => classifyInsuranceMonitoringFile(f) === 'invoicing' || isInsuranceRepairProcess(f),
  );
  const map = new Map<string, InsuranceNamedCountStat>();
  for (const file of repair) bumpNamedCount(map, insuranceCityOf(file), file);
  return [...map.values()].sort((a, b) => b.total - a.total || a.label.localeCompare(b.label, 'tr'));
}

/** Onarım aşamasındaki dosyalar — eksper bazlı */
export function buildInsuranceRepairByExpertStats(files: InsuranceClaimLike[]): InsuranceNamedCountStat[] {
  const repair = files.filter(
    (f) => classifyInsuranceMonitoringFile(f) === 'invoicing' || isInsuranceRepairProcess(f),
  );
  const map = new Map<string, InsuranceNamedCountStat>();
  for (const file of repair) bumpNamedCount(map, insuranceExpertOf(file), file);
  return [...map.values()].sort((a, b) => b.total - a.total || a.label.localeCompare(b.label, 'tr'));
}

/** 1) Eksper takibi · 2) Doğrudan ihbar / onarım süreci */
export type InsuranceFileTrack = 'expert_monitor' | 'direct_process';

export function classifyInsuranceFileTrack(file: InsuranceClaimLike): InsuranceFileTrack {
  const channel = (file.sourceChannel ?? '').trim().toLowerCase();
  if (channel === 'insurance_portal') return 'direct_process';
  // Eksper portalı veya atanmış eksper → eksper tarafı takibi
  if (channel === 'expert_portal' || file.assignedAdjuster?.id) return 'expert_monitor';
  // Kaynak bilinmeyen eski dosyalar: eksper atanmışsa takip, yoksa doğrudan süreç dışı portföy takibi
  return 'expert_monitor';
}

export function partitionInsuranceFilesByTrack(files: InsuranceClaimLike[]): {
  expertMonitor: InsuranceClaimLike[];
  directProcess: InsuranceClaimLike[];
} {
  const expertMonitor: InsuranceClaimLike[] = [];
  const directProcess: InsuranceClaimLike[] = [];
  for (const file of files) {
    if (classifyInsuranceFileTrack(file) === 'direct_process') directProcess.push(file);
    else expertMonitor.push(file);
  }
  return { expertMonitor, directProcess };
}

export function isInsuranceRepairProcess(file: InsuranceClaimLike): boolean {
  const code = (file.currentStatus?.code ?? '').trim();
  return REPAIR_PROCESS_CODES.has(code);
}

export type InsuranceMonitoringBucket =
  | 'open'
  | 'tespit'
  | 'in_progress'
  | 'awaiting_approval'
  | 'invoicing'
  | 'closed';

export function insuranceFileNo(file: { fileNo?: string; fileNumber?: string }): string {
  return file.fileNo ?? file.fileNumber ?? '—';
}

export function classifyInsuranceMonitoringFile(file: InsuranceClaimLike): InsuranceMonitoringBucket {
  const code = (file.currentStatus?.code ?? '').trim();
  if (CLOSED_CODES.has(code)) return 'closed';
  if (INVOICING_CODES.has(code)) return 'invoicing';
  if (AWAITING_APPROVAL_CODES.has(code)) return 'awaiting_approval';
  if (TESPIT_CODES.has(code)) return 'tespit';
  return 'in_progress';
}

export type InsuranceMonitoringCounts = {
  open: number;
  tespit: number;
  inProgress: number;
  awaitingApprovalFiles: number;
  invoicing: number;
  closed: number;
  total: number;
};

export function countInsuranceMonitoring(files: InsuranceClaimLike[]): InsuranceMonitoringCounts {
  const counts: InsuranceMonitoringCounts = {
    open: 0,
    tespit: 0,
    inProgress: 0,
    awaitingApprovalFiles: 0,
    invoicing: 0,
    closed: 0,
    total: files.length,
  };
  for (const file of files) {
    const bucket = classifyInsuranceMonitoringFile(file);
    if (bucket === 'closed') {
      counts.closed += 1;
      continue;
    }
    counts.open += 1;
    if (bucket === 'tespit') counts.tespit += 1;
    else if (bucket === 'in_progress') counts.inProgress += 1;
    else if (bucket === 'awaiting_approval') counts.awaitingApprovalFiles += 1;
    else if (bucket === 'invoicing') counts.invoicing += 1;
  }
  return counts;
}

export type InsuranceSubjectStat = {
  subject: string;
  total: number;
};

export function insuranceSubjectOf(file: InsuranceClaimLike): string {
  const fromSubject = (file.claimSubject?.name || file.subject || '').trim();
  if (fromSubject) return fromSubject;
  const fromLoss = (file.lossType || '').trim();
  if (fromLoss && !/^belirtilmem/i.test(fromLoss)) return fromLoss;
  return 'Belirtilmemiş';
}

/** Dosya konusu (ihbar konusu) bazlı dağılım */
export function buildInsuranceSubjectStats(files: InsuranceClaimLike[]): InsuranceSubjectStat[] {
  const map = new Map<string, InsuranceSubjectStat>();
  for (const file of files) {
    const subject = insuranceSubjectOf(file);
    const key = subject.toLocaleLowerCase('tr-TR');
    const row = map.get(key) ?? { subject, total: 0 };
    row.total += 1;
    map.set(key, row);
  }
  return [...map.values()].sort((a, b) => b.total - a.total || a.subject.localeCompare(b.subject, 'tr'));
}

/** Onarım bekleyen: onarım süreci + faturalama aşaması */
export function countInsuranceRepairWaiting(files: InsuranceClaimLike[]): number {
  return files.filter((f) => {
    const bucket = classifyInsuranceMonitoringFile(f);
    return bucket === 'invoicing' || isInsuranceRepairProcess(f);
  }).length;
}

/** Dosya Takip KPI aşamaları */
export type InsuranceStageBucket = 'yeni' | 'tespit' | 'onaylanan' | 'onarim' | 'other';

export function classifyInsuranceStage(file: InsuranceClaimLike): InsuranceStageBucket {
  const code = (file.currentStatus?.code ?? '').trim();
  if (CLOSED_CODES.has(code)) return 'other';
  if (code === 'new') return 'yeni';
  if (code === 'budget_approved') return 'onaylanan';
  if (INVOICING_CODES.has(code)) return 'onarim';
  if (REPAIR_PROCESS_CODES.has(code)) return 'onarim';
  if (TESPIT_CODES.has(code) || AWAITING_APPROVAL_CODES.has(code)) return 'tespit';
  return 'tespit';
}

export type InsuranceStageCounts = {
  yeni: number;
  tespit: number;
  onaylanan: number;
  onarim: number;
};

export function countInsuranceStages(files: InsuranceClaimLike[]): InsuranceStageCounts {
  const counts: InsuranceStageCounts = { yeni: 0, tespit: 0, onaylanan: 0, onarim: 0 };
  for (const file of files) {
    const stage = classifyInsuranceStage(file);
    if (stage === 'yeni') counts.yeni += 1;
    else if (stage === 'tespit') counts.tespit += 1;
    else if (stage === 'onaylanan') counts.onaylanan += 1;
    else if (stage === 'onarim') counts.onarim += 1;
  }
  return counts;
}

export type InsuranceDimensionFilters = {
  /** Boş = tüm kapsam (Toplam). Aksi halde seçili kanalların birleşimi. */
  tracks?: Array<'expert_monitor' | 'direct_process'>;
  cities?: string[];
  experts?: string[];
  branches?: string[];
};

function matchesLabel(value: string, selected: string[]): boolean {
  if (selected.length === 0) return true;
  const key = value.toLocaleLowerCase('tr-TR');
  return selected.some((s) => s.toLocaleLowerCase('tr-TR') === key);
}

/** Çoklu tercih: il ∩ eksper ∩ branş ∩ kanal */
export function filterInsuranceFilesByDimensions(
  files: InsuranceClaimLike[],
  filters: InsuranceDimensionFilters,
): InsuranceClaimLike[] {
  const tracks = filters.tracks ?? [];
  const cities = filters.cities ?? [];
  const experts = filters.experts ?? [];
  const branches = filters.branches ?? [];

  return files.filter((file) => {
    if (tracks.length > 0) {
      const track = classifyInsuranceFileTrack(file);
      if (!tracks.includes(track)) return false;
    }
    if (!matchesLabel(insuranceCityOf(file), cities)) return false;
    if (!matchesLabel(insuranceExpertOf(file), experts)) return false;
    if (!matchesLabel(insuranceBranchOf(file), branches)) return false;
    return true;
  });
}

export function sortInsuranceFilesByActivity(files: InsuranceClaimLike[]): InsuranceClaimLike[] {
  return [...files].sort((a, b) => {
    const ta = new Date(a.lastActivityAt || a.updatedAt || a.createdAt || 0).getTime();
    const tb = new Date(b.lastActivityAt || b.updatedAt || b.createdAt || 0).getTime();
    return tb - ta;
  });
}
