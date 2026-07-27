/** Dosya Operasyon Özeti — eksper görev alanları; kâr/maliyet/marj UI’a girmez */

import { normalizeReportImageCategory, type ReportImageCategoryKey } from '@/utils/quick-repair-damage-types';

export type ExpertDocCategory = 'hasarFotograflari' | 'muvafakatname' | 'dijitalOnay';

export const EXPERT_DOC_CATEGORY_LABEL: Record<ExpertDocCategory, string> = {
  hasarFotograflari: 'Hasar Fotoğrafları',
  muvafakatname: 'Muvafakatname',
  dijitalOnay: 'Dijital Onay',
};

export const EXPERT_DOC_CATEGORY_ORDER: ExpertDocCategory[] = [
  'hasarFotograflari',
  'muvafakatname',
  'dijitalOnay',
];

export type ExpertSafeDoc = {
  id: string;
  fileName?: string | null;
  documentType?: string | null;
  createdAt?: string | null;
  mimeType?: string | null;
  storageKey?: string | null;
  url?: string | null;
};

/** Belge tipini eksper operasyon kategorisine ayır (rapor / diğer yok) */
export function classifyExpertDocument(doc: ExpertSafeDoc): ExpertDocCategory | null {
  const blob = `${doc.documentType ?? ''} ${doc.fileName ?? ''} ${doc.mimeType ?? ''}`.toLocaleLowerCase('tr-TR');
  if (/muvafakat/.test(blob)) return 'muvafakatname';
  if (/dijital.?onay|digital.?approv|e-?imza|e.?imza|digitally.?approv/.test(blob)) return 'dijitalOnay';
  if (
    /foto|photo|image|img|jpeg|jpg|png|webp|hasar.?gör|hasar.?gor|image\//.test(blob) ||
    (doc.mimeType ?? '').startsWith('image/')
  ) {
    return 'hasarFotograflari';
  }
  return null;
}

export function groupExpertDocuments(docs: ExpertSafeDoc[]): Record<ExpertDocCategory, ExpertSafeDoc[]> {
  const groups: Record<ExpertDocCategory, ExpertSafeDoc[]> = {
    hasarFotograflari: [],
    muvafakatname: [],
    dijitalOnay: [],
  };
  for (const d of docs) {
    const cat = classifyExpertDocument(d);
    if (cat) groups[cat].push(d);
  }
  return groups;
}

const HIDDEN_NOTE_TYPE = /operasyon|yönetici|yonetici|internal|admin|muhasebe|finans|iç.?yazış|ic.?yazis/i;

export function isExpertVisibleNote(note: { noteType?: string | null; content?: string | null }): boolean {
  const t = note.noteType ?? '';
  if (HIDDEN_NOTE_TYPE.test(t)) return false;
  const c = note.content ?? '';
  if (/^\s*\[(operasyon|yönetici|yonetici|finans|muhasebe)\]/i.test(c)) return false;
  return true;
}

export type PresenceTone = 'ok' | 'missing' | 'pending';

export function presenceLabel(tone: PresenceTone, okText: string, missingText: string): string {
  if (tone === 'ok') return `✓ ${okText}`;
  return `✕ ${missingText}`;
}

export function presenceClass(tone: PresenceTone): string {
  if (tone === 'ok') return 'text-emerald-700';
  if (tone === 'pending') return 'text-amber-700';
  return 'text-rose-600';
}

/** Eksper-güvenli finansal özet — kâr / maliyet / marj / tedarikçi fiyatı yok */
export type ExpertSafeFinance = {
  buildingDamageTotal: number | null;
  goodsDamageTotal: number | null;
  repairAmount: number | null;
  totalFileAmount: number | null;
};

export type ExpertSafeDetail = {
  id: string;
  fileNo: string;
  claimNo?: string | null;
  lossType?: string | null;
  subject?: string | null;
  description?: string | null;
  insuredName?: string | null;
  propertyType?: string | null;
  productBranch?: string | null;
  createdAt?: string;
  updatedAt?: string | null;
  incidentDate?: string | null;
  notificationDate?: string | null;
  slaDueAt?: string | null;
  delayRisk?: boolean;
  closedAt?: string | null;
  statusChangedAt?: string | null;
  lastHumanActionAt?: string | null;
  lastActivityAt?: string | null;
  operationStatusLabel?: string | null;
  nextAction?: string | null;
  insuranceCompany?: { name?: string | null } | null;
  currentStatus?: { name?: string | null; code?: string | null } | null;
  propertyAddress?: {
    addressLine?: string | null;
    city?: string | null;
    district?: string | null;
  } | null;
  customer?: {
    city?: string | null;
    district?: string | null;
    address?: string | null;
  } | null;
  assignedAdjuster?: { firstName?: string | null; lastName?: string | null } | null;
  assignedOfficeUser?: { firstName?: string | null; lastName?: string | null } | null;
  assignedFieldUser?: { firstName?: string | null; lastName?: string | null } | null;
  currentResponsibleUser?: { firstName?: string | null; lastName?: string | null } | null;
  latestRepairReport?: {
    id?: string;
    status?: string | null;
    reportDate?: string | null;
    updatedAt?: string | null;
    reportNo?: string | null;
    findingsText?: string | null;
    revisedAt?: string | null;
    buildingDamageTotal?: number | null;
    goodsDamageTotal?: number | null;
    totalSalesAmount?: number | null;
  } | null;
  expertFinance?: ExpertSafeFinance | null;
};

export function isKonutBranch(detail: Pick<ExpertSafeDetail, 'propertyType' | 'productBranch'> | null | undefined): boolean {
  const blob = `${detail?.propertyType ?? ''} ${detail?.productBranch ?? ''}`.toLocaleLowerCase('tr-TR');
  return /konut|mesken|daire|apartman/.test(blob);
}

export function pickExpertSafeFinance(
  report?: ExpertSafeDetail['latestRepairReport'] | Record<string, unknown> | null,
): ExpertSafeFinance | null {
  if (!report || typeof report !== 'object') return null;
  const building = numOrNull((report as any).buildingDamageTotal);
  const goods = numOrNull((report as any).goodsDamageTotal);
  const sales = numOrNull((report as any).totalSalesAmount);
  const sumParts =
    building != null || goods != null ? (building ?? 0) + (goods ?? 0) : null;
  const repairAmount = sales != null && sales > 0 ? sales : sumParts;
  const totalFileAmount = sales != null && sales > 0 ? sales : sumParts;
  if (building == null && goods == null && repairAmount == null && totalFileAmount == null) return null;
  return {
    buildingDamageTotal: building,
    goodsDamageTotal: goods,
    repairAmount,
    totalFileAmount,
  };
}

function numOrNull(v: unknown): number | null {
  if (v == null || v === '') return null;
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

export function formatExpertMoney(amount: number | null | undefined): string {
  if (amount == null || !Number.isFinite(amount)) return '—';
  return new Intl.NumberFormat('tr-TR', {
    style: 'currency',
    currency: 'TRY',
    maximumFractionDigits: 0,
  }).format(amount);
}

export function pickExpertSafeDetail(raw: Record<string, unknown> | null | undefined): ExpertSafeDetail | null {
  if (!raw || typeof raw !== 'object') return null;
  const insurance = raw.insuranceCompany as ExpertSafeDetail['insuranceCompany'];
  const status = raw.currentStatus as ExpertSafeDetail['currentStatus'];
  const addr = raw.propertyAddress as ExpertSafeDetail['propertyAddress'];
  const customer = raw.customer as ExpertSafeDetail['customer'];
  const adjuster = raw.assignedAdjuster as ExpertSafeDetail['assignedAdjuster'];
  const officeUser = raw.assignedOfficeUser as ExpertSafeDetail['assignedOfficeUser'];
  const fieldUser = raw.assignedFieldUser as ExpertSafeDetail['assignedFieldUser'];
  const responsible = raw.currentResponsibleUser as ExpertSafeDetail['currentResponsibleUser'];
  const report = raw.latestRepairReport as Record<string, unknown> | null | undefined;

  const latestRepairReport = report
    ? {
        id: report.id as string | undefined,
        status: (report.status as string | null | undefined) ?? null,
        reportDate: (report.reportDate as string | null | undefined) ?? null,
        updatedAt: (report.updatedAt as string | null | undefined) ?? null,
        reportNo: (report.reportNo as string | null | undefined) ?? null,
        findingsText: (report.findingsText as string | null | undefined) ?? null,
        revisedAt: (report.revisedAt as string | null | undefined) ?? null,
        buildingDamageTotal: numOrNull(report.buildingDamageTotal),
        goodsDamageTotal: numOrNull(report.goodsDamageTotal),
        totalSalesAmount: numOrNull(report.totalSalesAmount),
      }
    : null;

  return {
    id: String(raw.id ?? ''),
    fileNo: String(raw.fileNo ?? raw.fileNumber ?? '—'),
    claimNo: (raw.claimNo as string | null | undefined) ?? null,
    lossType: (raw.lossType as string | null | undefined) ?? null,
    subject:
      (raw.subject as string | null | undefined) ??
      (raw.claimSubject as { name?: string } | null)?.name ??
      null,
    description: (raw.description as string | null | undefined) ?? null,
    insuredName: (raw.insuredName as string | null | undefined) ?? null,
    propertyType: (raw.propertyType as string | null | undefined) ?? null,
    productBranch: (raw.productBranch as string | null | undefined) ?? null,
    createdAt: raw.createdAt as string | undefined,
    updatedAt: (raw.updatedAt as string | null | undefined) ?? null,
    incidentDate: (raw.incidentDate as string | null | undefined) ?? null,
    notificationDate: (raw.notificationDate as string | null | undefined) ?? null,
    slaDueAt: (raw.slaDueAt as string | null | undefined) ?? null,
    delayRisk: Boolean(raw.delayRisk),
    closedAt: (raw.closedAt as string | null | undefined) ?? null,
    statusChangedAt: (raw.statusChangedAt as string | null | undefined) ?? null,
    lastHumanActionAt: (raw.lastHumanActionAt as string | null | undefined) ?? null,
    lastActivityAt: (raw.lastActivityAt as string | null | undefined) ?? null,
    operationStatusLabel: (raw.operationStatusLabel as string | null | undefined) ?? null,
    nextAction: (raw.nextAction as string | null | undefined) ?? null,
    insuranceCompany: insurance ? { name: insurance.name ?? null } : null,
    currentStatus: status ? { name: status.name ?? null, code: status.code ?? null } : null,
    propertyAddress: addr
      ? {
          addressLine: addr.addressLine ?? null,
          city: addr.city ?? null,
          district: addr.district ?? null,
        }
      : null,
    customer: customer
      ? {
          city: customer.city ?? null,
          district: customer.district ?? null,
          address: customer.address ?? null,
        }
      : null,
    assignedAdjuster: adjuster
      ? { firstName: adjuster.firstName ?? null, lastName: adjuster.lastName ?? null }
      : null,
    assignedOfficeUser: officeUser
      ? { firstName: officeUser.firstName ?? null, lastName: officeUser.lastName ?? null }
      : null,
    assignedFieldUser: fieldUser
      ? { firstName: fieldUser.firstName ?? null, lastName: fieldUser.lastName ?? null }
      : null,
    currentResponsibleUser: responsible
      ? { firstName: responsible.firstName ?? null, lastName: responsible.lastName ?? null }
      : null,
    latestRepairReport,
    expertFinance: pickExpertSafeFinance(latestRepairReport),
  };
}

export function personName(p?: { firstName?: string | null; lastName?: string | null } | null): string {
  if (!p) return '—';
  const n = `${p.firstName ?? ''} ${p.lastName ?? ''}`.trim();
  return n || '—';
}

/** Gizlilik amaçlı maskeli isim — "Mxxxxxxx Yxxxxxx" formatı */
function maskNamePart(part: string): string {
  const trimmed = part.trim();
  if (!trimmed) return '';
  const first = trimmed.charAt(0).toLocaleUpperCase('tr-TR');
  const maskLength = Math.max(trimmed.length - 1, 3);
  return `${first}${'x'.repeat(maskLength)}`;
}

export function maskPersonName(p?: { firstName?: string | null; lastName?: string | null } | null): string {
  if (!p) return '—';
  const parts = [maskNamePart(p.firstName ?? ''), maskNamePart(p.lastName ?? '')].filter(Boolean);
  return parts.length > 0 ? parts.join(' ') : '—';
}

export type ExpertApprovalStatus =
  | 'Onay Bekleniyor'
  | 'Revizyon Bekleniyor'
  | 'Onaylandı'
  | 'Henüz Gönderilmedi';

export type ExpertRepairStatus =
  | 'Onarım Başlamadı'
  | 'Onarım Devam Ediyor'
  | 'Onarım Tamamlandı'
  | 'Onarım Planlanıyor';

export type ExpertOperationSummary = {
  inspectionDone: boolean;
  inspectionDate: string | null;
  notificationDate: string | null;
  expertApprovalStatus: ExpertApprovalStatus;
  expertApprovalDate: string | null;
  repairStatus: ExpertRepairStatus;
  waitingApproval: boolean;
  revisionRequested: boolean;
  lastActionLabel: string;
  pendingActionLabel: string;
};

function reportStatusKey(detail: ExpertSafeDetail): string {
  return (detail.latestRepairReport?.status ?? '').toLocaleLowerCase('tr-TR');
}

function statusCodeKey(detail: ExpertSafeDetail): string {
  return (detail.currentStatus?.code ?? '').toLocaleLowerCase('tr-TR');
}

function statusNameKey(detail: ExpertSafeDetail): string {
  return (detail.currentStatus?.name ?? '').toLocaleLowerCase('tr-TR');
}

export function deriveExpertApprovalStatus(detail: ExpertSafeDetail): {
  status: ExpertApprovalStatus;
  date: string | null;
  waitingApproval: boolean;
  revisionRequested: boolean;
} {
  const rs = reportStatusKey(detail);
  const code = statusCodeKey(detail);
  const name = statusNameKey(detail);
  const report = detail.latestRepairReport;

  if (/revision|revizyon/.test(rs) || code === 'budget_revision_requested' || /revizyon/.test(name)) {
    return {
      status: 'Revizyon Bekleniyor',
      date: report?.revisedAt ?? report?.updatedAt ?? detail.statusChangedAt ?? null,
      waitingApproval: false,
      revisionRequested: true,
    };
  }

  if (
    /pending_approval|pending|submitted|gönder|gonder/.test(rs) ||
    code === 'budget_submitted' ||
    /onay bek/.test(name)
  ) {
    return {
      status: 'Onay Bekleniyor',
      date: report?.reportDate ?? report?.updatedAt ?? detail.statusChangedAt ?? null,
      waitingApproval: true,
      revisionRequested: false,
    };
  }

  if (/approved|onayland|completed|tamam/.test(rs) || code === 'budget_approved' || /onayland/.test(name)) {
    return {
      status: 'Onaylandı',
      date: report?.updatedAt ?? detail.statusChangedAt ?? null,
      waitingApproval: false,
      revisionRequested: false,
    };
  }

  if (!report?.id) {
    return {
      status: 'Henüz Gönderilmedi',
      date: null,
      waitingApproval: false,
      revisionRequested: false,
    };
  }

  return {
    status: 'Onay Bekleniyor',
    date: report.reportDate ?? report.updatedAt ?? null,
    waitingApproval: true,
    revisionRequested: false,
  };
}

export function deriveExpertRepairStatus(detail: ExpertSafeDetail): ExpertRepairStatus {
  const code = statusCodeKey(detail);
  const name = statusNameKey(detail);
  const label = (detail.operationStatusLabel ?? '').toLocaleLowerCase('tr-TR');

  if (
    code === 'repair_completed' ||
    /onarım tamam|onarim tamam|tamamlandı|tamamlandi/.test(name) ||
    /onarım tamam|onarim tamam/.test(label)
  ) {
    return 'Onarım Tamamlandı';
  }
  if (
    code === 'repair_in_progress' ||
    /onarım devam|onarim devam|devam ediyor/.test(name) ||
    /onarım devam|onarim devam/.test(label)
  ) {
    return 'Onarım Devam Ediyor';
  }
  if (
    code === 'repair_planning' ||
    code === 'budget_approved' ||
    /onarım plan|onarim plan|planlanıyor|planlaniyor/.test(name)
  ) {
    return 'Onarım Planlanıyor';
  }
  return 'Onarım Başlamadı';
}

/**
 * İç ofis durum akışını (18 aşamalı) eksper için sade, operasyonel aşama adına çevirir.
 * "Dosya Durumu" rozeti burada üretilen metni gösterir; renklendirme (expertStatusBadgeClass)
 * bu sade kelimeleri (tespit/rapor/onay/tamam) zaten tanıyacak şekilde yazılmıştır.
 */
export function deriveExpertFileStageLabel(detail: ExpertSafeDetail): string {
  const code = statusCodeKey(detail);
  const name = statusNameKey(detail);
  const rawName = detail.currentStatus?.name ?? '—';

  if (code === 'test_status') return rawName;
  if (code === 'closed' || /kapat/.test(name)) return 'Tamamlandı';
  if (code === 'cancelled' || /iptal/.test(name)) return 'İptal Edildi';
  if (['new', 'pre_review', 'adjuster_assigned', 'site_visit_planned'].includes(code)) {
    return 'Tespit Aşamasında';
  }
  if (code === 'site_visit_done' || code === 'budget_preparing') {
    return 'Rapor Yazım Aşamasında';
  }
  if (code === 'budget_submitted') return 'Onay Bekleniyor';
  if (code === 'budget_revision_requested') return 'Revizyon Bekleniyor';
  if (['budget_approved', 'repair_planning', 'repair_in_progress'].includes(code)) {
    return 'Onarım Sürecinde';
  }
  if (
    ['repair_completed', 'invoice_pending', 'invoice_submitted', 'payment_pending', 'partially_collected'].includes(
      code,
    )
  ) {
    return 'Dosya Kapanış Sürecinde';
  }
  // Bilinmeyen/yeni bir durum kodu gelirse sessizce boş kalmasın — ham adı göster.
  return rawName;
}

export function deriveExpertOperationSummary(
  detail: ExpertSafeDetail,
  lastActivityTitle?: string | null,
): ExpertOperationSummary {
  const code = statusCodeKey(detail);
  const name = statusNameKey(detail);
  const hasReport = Boolean(detail.latestRepairReport?.id);
  const inspectionDone =
    Boolean(detail.incidentDate) ||
    hasReport ||
    code === 'site_visit_done' ||
    code === 'inspection_done' ||
    /tespit|incele|ekspertiz|keşif|kesif|saha/.test(name);

  const approval = deriveExpertApprovalStatus(detail);
  const repairStatus = deriveExpertRepairStatus(detail);

  const pendingFromNext = (detail.nextAction ?? '').trim();
  let pendingActionLabel = pendingFromNext;
  if (!pendingActionLabel) {
    if (approval.revisionRequested) pendingActionLabel = 'Revizyonu tamamlayın';
    else if (approval.waitingApproval) pendingActionLabel = 'Onay sonucu bekleniyor';
    else if (repairStatus === 'Onarım Devam Ediyor') pendingActionLabel = 'Onarım sürecini takip edin';
    else if (!inspectionDone) pendingActionLabel = 'Hasar tespitini tamamlayın';
    else pendingActionLabel = 'Bekleyen aksiyon yok';
  }

  const lastActionLabel =
    (lastActivityTitle ?? '').trim() ||
    detail.operationStatusLabel?.trim() ||
    detail.currentStatus?.name ||
    'Son işlem kaydı yok';

  return {
    inspectionDone,
    inspectionDate: detail.incidentDate ?? null,
    notificationDate: detail.notificationDate ?? detail.createdAt ?? null,
    expertApprovalStatus: approval.status,
    expertApprovalDate: approval.date,
    repairStatus,
    waitingApproval: approval.waitingApproval,
    revisionRequested: approval.revisionRequested,
    lastActionLabel,
    pendingActionLabel,
  };
}

/** Operasyon geçmişi başlıkları — eksper dili */
export function expertOperationEventTitle(input: {
  kind: 'opened' | 'transition' | 'activity';
  action?: string | null;
  statusCode?: string | null;
  statusName?: string | null;
  fallback?: string | null;
}): string {
  const action = (input.action ?? '').toUpperCase();
  const code = (input.statusCode ?? '').toLowerCase();
  const name = (input.statusName ?? '').toLocaleLowerCase('tr-TR');
  const fallback = (input.fallback ?? '').toLocaleLowerCase('tr-TR');
  const blob = `${action} ${code} ${name} ${fallback}`;

  if (input.kind === 'opened') return 'Dosya Açıldı';
  if (/INSPECTION_DONE|site_visit_done|tespit/.test(blob)) return 'Hasar Tespiti Yapıldı';
  if (/ATTACHMENT_ADDED|foto|görsel|gorsel|photo|image/.test(blob)) return 'Fotoğraf Yüklendi';
  if (/dijital.?onay|digitally_approved|DIGITAL_APPROVAL/.test(blob)) return 'Dijital Onay Alındı';
  if (/muvafakat|MUVAFAKAT/.test(blob)) return 'Muvafakatname Yüklendi';
  if (/budget_revision_requested|REVISION_REQUESTED|revizyon.?isten/.test(blob)) return 'Revizyon İstendi';
  if (/revision.?tamam|REVISION_COMPLETED|revize.?rapor.?gönder|revize.?rapor.?gonder/.test(blob)) {
    return 'Revizyon Tamamlandı';
  }
  if (/repair_in_progress|REPAIR_STARTED|onarım.?baş|onarim.?bas/.test(blob)) return 'Onarım Başladı';
  if (/repair_completed|REPAIR_COMPLETED|onarım.?tamam|onarim.?tamam/.test(blob)) return 'Onarım Tamamlandı';
  if (/budget_submitted|COST_REPORT_SUBMITTED|rapor.?gönder|rapor.?gonder/.test(blob)) return 'Rapor Gönderildi';
  if (/budget_approved|onayland/.test(blob)) return 'Onay Alındı';
  if (/NOTE_ADDED|not.?ekl/.test(blob)) return 'Not Eklendi';
  if (input.fallback?.trim()) return input.fallback.trim();
  if (input.statusName?.trim()) return input.statusName.trim();
  return 'Operasyon Güncellendi';
}

/** Onarım raporu fotoğrafları — Dosya Ekleri sekmesinde eksper-güvenli minimal gösterim */
export type ExpertReportImage = {
  id: string;
  storageKey: string;
  category?: string | null;
};

export const EXPERT_REPORT_IMAGE_LABEL: Record<ReportImageCategoryKey, string> = {
  before: 'Hasar Tespit Resimleri',
  damage: 'Onarım Resimleri',
  after: 'Onarım Bitiş Resimleri',
};

export const EXPERT_REPORT_IMAGE_ORDER: ReportImageCategoryKey[] = ['before', 'damage', 'after'];

export function groupExpertReportImages(
  images: ExpertReportImage[],
): Record<ReportImageCategoryKey, ExpertReportImage[]> {
  const groups: Record<ReportImageCategoryKey, ExpertReportImage[]> = {
    before: [],
    damage: [],
    after: [],
  };
  for (const img of images) {
    const key = normalizeReportImageCategory(img.category);
    groups[key].push(img);
  }
  return groups;
}
