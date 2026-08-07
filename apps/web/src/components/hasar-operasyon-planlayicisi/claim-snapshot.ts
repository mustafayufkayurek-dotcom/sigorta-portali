/**
 * Operasyon Planlayıcısı — canlı dosya anlık görüntüsü
 * Rapor yazım sayfasına dokunulmaz; yalnızca yönlendirme için raporlar sekmesi kullanılır.
 */

import type { StepId, StepStatus } from './types';
import { PLANNER_STEPS } from './types';
import { PREVIEW } from './preview-data';
import {
  computePlannerStepStatuses,
  formatLiveReportFinance,
  hasDigitalApprovalApproved,
  hasWhatsappSent as activityHasWhatsappSent,
} from './planner-live-rules';

export type PlannerMode = 'preview' | 'live';

export type PlannerInspector = {
  id: string;
  name: string;
  region: string;
  available: boolean;
  score: number;
  lastWork: string;
  completedJobs: number;
  phone: string;
  /** Meridyen saha personeli veya tespitçi olarak görevlendirilmiş tedarikçi */
  source: 'meridyen' | 'vendor';
};

export type PlannerSupplier = {
  id: string;
  name: string;
  serviceGroup: string;
  place: string;
  rating: string;
  avail: string;
  phone?: string;
  note?: string;
};

export type PlannerProgressLine = {
  state: 'done' | 'waiting' | 'future';
  text: string;
  when: string | null;
  step: StepId;
};

export type PlannerClaimSnapshot = {
  claimId: string | null;
  fileNo: string;
  statusLabel: string;
  insuredName: string;
  insuredPhone: string;
  insurer: string;
  lossType: string;
  noticeAt: string;
  appointmentDate: string;
  appointmentTime: string;
  appointmentAt: string;
  durationMinutes: string;
  locationUrl: string;
  address: string;
  district: string;
  owner: string;
  insuredApproval: boolean;
  inspectors: PlannerInspector[];
  suppliers: PlannerSupplier[];
  /** Alternatif öneriler — canlıda boş veya API; Google etiketi yok */
  alternativeSuppliers: Array<{ name: string; place: string; rating: string }>;
  progressLines: PlannerProgressLine[];
  risks: Array<{ tone: 'critical' | 'info'; text: string; step: StepId }>;
  people: Array<{
    initials: string;
    name: string;
    role: string;
    status: 'Atandı' | 'Atanmadı' | string;
  }>;
  notes: Array<{ who: string; when: string; text: string }>;
  report: {
    id: string | null;
    number: string;
    revision: string | number;
    status: string;
    owner: string;
    updatedAt: string;
    total: string;
    supplierCost: string;
    actualExpense: string;
    expectedIncome: string;
    profit: string;
    margin: string;
    vatNote: string;
    missingDocs: number;
    photoCount: number;
    readyChecks: {
      reportComplete: boolean;
      docsComplete: boolean;
      photosComplete: boolean;
      financeReady: boolean;
      revisionOk: boolean;
    };
  };
  revisions: Array<{
    n: number;
    date: string;
    by: string;
    reason: string;
    note: string;
    active: boolean;
  }>;
  waHistory: Array<{
    when: string;
    by: string;
    recipient: string;
    template: string;
    status: string;
  }>;
  completedCount: number;
  totalCount: number;
  completionPct: number;
  eta: string;
  stepStatuses: Record<StepId, StepStatus>;
  preAssignedInspectorId: string | null;
  preAssignedSupplierIds: string[];
};

function fmtDateTime(iso: string | null | undefined): { date: string; time: string; at: string } {
  if (!iso) return { date: '', time: '', at: '—' };
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return { date: '', time: '', at: '—' };
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = String(d.getFullYear());
  const date = `${dd}.${mm}.${yyyy}`;
  const time = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  return { date, time, at: `${date} ${time}` };
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ''}${parts[1][0] ?? ''}`.toUpperCase();
}

function reportStatusLabel(status: string | null | undefined): string {
  const s = String(status ?? '').toLowerCase();
  if (!s) return 'Taslak';
  if (s === 'draft') return 'Taslak';
  if (s === 'submitted' || s === 'sent_for_approval') return 'Onaya Gönderildi';
  if (s === 'approved' || s === 'externally_approved') return 'Onaylandı';
  if (s === 'rejected' || s === 'externally_rejected') return 'Reddedildi';
  if (s.includes('writing') || s === 'in_progress') return 'Yazım Aşamasında';
  return status ?? 'Taslak';
}

/** Lokal önizleme anlık görüntüsü */
export function previewSnapshot(): PlannerClaimSnapshot {
  const stepStatuses = Object.fromEntries(
    PLANNER_STEPS.map((s) => [s.id, s.status]),
  ) as Record<StepId, StepStatus>;
  return {
    claimId: null,
    fileNo: PREVIEW.fileNo,
    statusLabel: PREVIEW.statusLabel,
    insuredName: PREVIEW.insuredName,
    insuredPhone: PREVIEW.insuredPhone,
    insurer: PREVIEW.insurer,
    lossType: PREVIEW.lossType,
    noticeAt: PREVIEW.noticeAt,
    appointmentDate: PREVIEW.appointmentDate,
    appointmentTime: PREVIEW.appointmentTime,
    appointmentAt: PREVIEW.appointmentAt,
    durationMinutes: PREVIEW.durationMinutes,
    locationUrl: PREVIEW.locationUrl,
    address: PREVIEW.address,
    district: PREVIEW.district,
    owner: PREVIEW.owner,
    insuredApproval: PREVIEW.insuredApproval,
    inspectors: PREVIEW.inspectors,
    suppliers: PREVIEW.suppliers,
    alternativeSuppliers: PREVIEW.googleAlternatives.map((g) => ({
      name: g.name,
      place: g.place,
      rating: g.rating,
    })),
    progressLines: PREVIEW.progressLines,
    risks: PREVIEW.risks,
    people: PREVIEW.people,
    notes: PREVIEW.notes,
    report: PREVIEW.report,
    revisions: PREVIEW.revisions,
    waHistory: PREVIEW.waHistory,
    completedCount: PREVIEW.completedCount,
    totalCount: PREVIEW.totalCount,
    completionPct: PREVIEW.completionPct,
    eta: PREVIEW.eta,
    stepStatuses,
    preAssignedInspectorId: 'i1',
    preAssignedSupplierIds: [],
  };
}

type OperationCenterPayload = {
  claim: {
    id: string;
    fileNo: string;
    insuredName: string | null;
    insuredPhone: string | null;
    lossType: string | null;
    serviceGroup: string | null;
    address: string | null;
    city: string | null;
    district: string | null;
    locationUrl: string | null;
  };
  mainAppointment: {
    scheduledAt: string;
    location: string | null;
    locationUrl: string | null;
    estimatedDurationMinutes: number | null;
    notes: string | null;
  } | null;
  assignedInspector: {
    id: string;
    name?: string | null;
    companyName?: string | null;
    phone?: string | null;
  } | null;
  assignedSuppliers: Array<{
    id: string;
    name?: string | null;
    companyName?: string | null;
    phone?: string | null;
    city?: string | null;
    district?: string | null;
    workGroups?: Array<{ name: string }>;
  }>;
  activity: Array<{
    id: string;
    action: string;
    description: string;
    createdAt: string;
    metadata?: Record<string, unknown> | null;
    actor?: { firstName: string; lastName: string } | null;
  }>;
};

type ClaimFileLite = {
  id: string;
  fileNo?: string;
  status?: string;
  insuredName?: string | null;
  insuredPhone?: string | null;
  lossType?: string | null;
  insuranceCompany?: { name?: string } | null;
  customer?: { fullName?: string; companyName?: string; phone?: string } | null;
  assignedUser?: { firstName?: string; lastName?: string } | null;
  assignedOfficeUser?: { firstName?: string; lastName?: string } | null;
  assignedFieldUser?: {
    id: string;
    firstName?: string | null;
    lastName?: string | null;
    phone?: string | null;
  } | null;
  assignedFieldUserId?: string | null;
  assignedInspectorVendorId?: string | null;
  latestRepairReport?: {
    id?: string | null;
    reportNo?: string | null;
    status?: string | null;
    revisionNo?: number | null;
    totalSalesAmount?: number | null;
    totalSupplierCost?: number | null;
    grossProfit?: number | null;
    grossMarginPct?: number | null;
    updatedAt?: string | null;
    createdBy?: { firstName?: string; lastName?: string } | null;
  } | null;
  createdAt?: string;
};

export function mapLiveSnapshot(
  op: OperationCenterPayload,
  claimFile?: ClaimFileLite | null,
  candidateInspectors: PlannerInspector[] = [],
  candidateSuppliers: PlannerSupplier[] = [],
): PlannerClaimSnapshot {
  const appt = fmtDateTime(op.mainAppointment?.scheduledAt);
  const notice = fmtDateTime(claimFile?.createdAt);
  const fieldInspectorName = claimFile?.assignedFieldUser
    ? `${claimFile.assignedFieldUser.firstName ?? ''} ${claimFile.assignedFieldUser.lastName ?? ''}`.trim()
    : '';
  const inspectorName =
    op.assignedInspector?.name ??
    op.assignedInspector?.companyName ??
    (fieldInspectorName || null);
  const ownerName = claimFile?.assignedOfficeUser
    ? `${claimFile.assignedOfficeUser.firstName ?? ''} ${claimFile.assignedOfficeUser.lastName ?? ''}`.trim()
    : claimFile?.assignedUser
      ? `${claimFile.assignedUser.firstName ?? ''} ${claimFile.assignedUser.lastName ?? ''}`.trim()
      : '—';

  const hasAppt = Boolean(op.mainAppointment?.scheduledAt);
  const hasInspector = Boolean(
    op.assignedInspector?.id || claimFile?.assignedFieldUserId || claimFile?.assignedFieldUser?.id,
  );
  const hasSupplier = op.assignedSuppliers.length > 0;

  const waSentActivities = op.activity.filter((a) => {
    if (a.action !== 'WHATSAPP_STATUS_RECORDED') return false;
    const meta = (a.metadata ?? {}) as Record<string, unknown>;
    return meta.status === 'sent' || String(a.description ?? '').includes('sent');
  });
  const hasWhatsappSent = activityHasWhatsappSent(op.activity);
  const digitalApproved = hasDigitalApprovalApproved(op.activity);
  const digitalActivities = op.activity.filter((a) => {
    const meta = (a.metadata ?? {}) as Record<string, unknown>;
    return meta.kind === 'digital_approval';
  });
  const digitalSent = digitalActivities.some((a) => {
    const meta = (a.metadata ?? {}) as Record<string, unknown>;
    return meta.status === 'sent' || meta.status === 'approved';
  });

  const rr = claimFile?.latestRepairReport;
  const stepStatuses = computePlannerStepStatuses({
    hasAppt,
    hasInspector,
    hasSupplier,
    activity: op.activity,
    report: rr,
  }) as Record<StepId, StepStatus>;
  const reportWritingDone = stepStatuses.report_writing === 'done';
  const reportSentForApproval = stepStatuses.sent_for_approval === 'done';
  const reportApproved = stepStatuses.approved === 'done';
  const hasReport = Boolean(rr?.id || rr?.reportNo);

  const completedCount = Object.values(stepStatuses).filter((s) => s === 'done').length;

  const suppliersFromAssigned: PlannerSupplier[] = op.assignedSuppliers.map((s) => ({
    id: s.id,
    name: s.name ?? s.companyName ?? 'Tedarikçi',
    serviceGroup: s.workGroups?.[0]?.name ?? op.claim.serviceGroup ?? 'Hizmet',
    place: [s.district, s.city].filter(Boolean).join(' / ') || '—',
    rating: '—',
    avail: 'Müsait' as const,
    phone: s.phone ?? undefined,
  }));

  const inspectors =
    candidateInspectors.length > 0
      ? candidateInspectors
      : op.assignedInspector
        ? [
            {
              id: op.assignedInspector.id,
              name: inspectorName ?? 'Tespitçi',
              region: op.claim.district ?? '—',
              available: true,
              score: 0,
              lastWork: '—',
              completedJobs: 0,
              phone: op.assignedInspector.phone ?? '',
              source: 'vendor' as const,
            },
          ]
        : claimFile?.assignedFieldUser
          ? [
              {
                id: claimFile.assignedFieldUser.id,
                name: fieldInspectorName || 'Tespitçi',
                region: op.claim.district ?? '—',
                available: true,
                score: 0,
                lastWork: '—',
                completedJobs: 0,
                phone: claimFile.assignedFieldUser.phone ?? '',
                source: 'meridyen' as const,
              },
            ]
          : [];

  const suppliers =
    candidateSuppliers.length > 0
      ? [
          ...suppliersFromAssigned,
          ...candidateSuppliers.filter((c) => !suppliersFromAssigned.some((a) => a.id === c.id)),
        ]
      : suppliersFromAssigned.length > 0
        ? suppliersFromAssigned
        : [];

  const finance = formatLiveReportFinance(rr);
  const hasFinance = finance.total !== '—';
  const report = {
    id: rr?.id ?? null,
    number: rr?.reportNo ?? '—',
    status: reportStatusLabel(rr?.status),
    revision: rr?.revisionNo != null ? `R${rr.revisionNo}` : 'R0',
    owner: rr?.createdBy
      ? `${rr.createdBy.firstName ?? ''} ${rr.createdBy.lastName ?? ''}`.trim()
      : ownerName,
    updatedAt: rr?.updatedAt ? fmtDateTime(rr.updatedAt).at : '—',
    total: finance.total,
    supplierCost: finance.supplierCost,
    actualExpense: '—',
    expectedIncome: finance.expectedIncome,
    profit: finance.profit,
    margin: finance.margin,
    vatNote: 'Kdv Hariç',
    missingDocs: 0,
    photoCount: 0,
    readyChecks: {
      reportComplete: reportWritingDone || reportApproved,
      docsComplete: false,
      photosComplete: false,
      financeReady: hasFinance,
      revisionOk: true,
    },
  };

  const progressLines: PlannerProgressLine[] = [
    {
      state: hasAppt ? 'done' : 'waiting',
      text: hasAppt ? 'Randevu oluşturuldu' : 'Randevu bekleniyor',
      when: hasAppt ? appt.at : null,
      step: 'insured_appointment',
    },
    {
      state: hasInspector ? 'done' : 'waiting',
      text: hasInspector ? 'Tespitçi ataması yapıldı' : 'Tespitçi ataması bekleniyor',
      when: null,
      step: 'inspector',
    },
    {
      state: hasSupplier ? 'done' : 'waiting',
      text: hasSupplier ? 'Tedarikçi ataması yapıldı' : 'Tedarikçi ataması bekleniyor',
      when: null,
      step: 'supplier',
    },
    {
      state: hasWhatsappSent ? 'done' : hasSupplier ? 'waiting' : 'future',
      text: hasWhatsappSent
        ? 'WhatsApp bilgilendirme tamamlandı'
        : 'WhatsApp bilgilendirme bekleniyor',
      when: hasWhatsappSent ? fmtDateTime(waSentActivities[0]?.createdAt).at : null,
      step: 'whatsapp',
    },
    {
      state: digitalApproved ? 'done' : hasWhatsappSent ? 'waiting' : 'future',
      text: digitalApproved
        ? 'Dijital onay tamamlandı'
        : digitalSent
          ? 'Dijital onay gönderildi'
          : 'Dijital onay bekleniyor',
      when: digitalApproved
        ? fmtDateTime(digitalActivities.find((a) => (a.metadata as any)?.status === 'approved')?.createdAt).at
        : null,
      step: 'digital_approval',
    },
    {
      state: reportWritingDone ? 'done' : digitalApproved || hasReport ? 'waiting' : 'future',
      text: reportWritingDone ? 'Rapor yazımı tamamlandı' : 'Rapor yazım aşamasında',
      when: null,
      step: 'report_writing',
    },
    {
      state: reportSentForApproval ? 'done' : reportWritingDone ? 'waiting' : 'future',
      text: reportSentForApproval ? 'Onaya gönderildi' : 'Onaya gönderilecek',
      when: null,
      step: 'sent_for_approval',
    },
    {
      state: reportApproved ? 'done' : reportSentForApproval ? 'waiting' : 'future',
      text: reportApproved ? 'Onaylandı' : 'Onay bekleniyor',
      when: null,
      step: 'approved',
    },
  ];

  const notes = op.activity.slice(0, 5).map((a) => ({
    who: a.actor
      ? `${a.actor.firstName} ${a.actor.lastName}`.trim()
      : 'Sistem',
    when: fmtDateTime(a.createdAt).at,
    text: a.description,
  }));

  const recipientLabel: Record<string, string> = {
    insured: 'Sigortalı',
    adjuster: 'Tespitçi',
    vendor: 'Tedarikçi',
  };

  const waHistory = op.activity
    .filter((a) => a.action === 'WHATSAPP_STATUS_RECORDED')
    .slice(0, 10)
    .map((a) => {
      const meta = (a.metadata ?? {}) as Record<string, unknown>;
      const statusRaw = String(meta.status ?? '');
      const status =
        statusRaw === 'sent'
          ? 'Gönderildi'
          : statusRaw === 'ready'
            ? 'Hazır'
            : statusRaw === 'opened'
              ? 'Açıldı'
              : statusRaw || 'Kayıt';
      return {
        when: fmtDateTime(a.createdAt).at,
        by: a.actor
          ? `${a.actor.firstName} ${a.actor.lastName}`.trim()
          : 'Sistem',
        recipient:
          (typeof meta.recipientName === 'string' && meta.recipientName) ||
          recipientLabel[String(meta.recipientType ?? '')] ||
          'Alıcı',
        template:
          (typeof meta.templateType === 'string' && meta.templateType) ||
          'WhatsApp',
        status,
      };
    });

  return {
    claimId: op.claim.id,
    fileNo: op.claim.fileNo,
    statusLabel: claimFile?.status ?? 'Açık',
    insuredName:
      op.claim.insuredName ??
      claimFile?.insuredName ??
      claimFile?.customer?.fullName ??
      claimFile?.customer?.companyName ??
      '—',
    insuredPhone:
      op.claim.insuredPhone ??
      claimFile?.insuredPhone ??
      claimFile?.customer?.phone ??
      '',
    insurer: claimFile?.insuranceCompany?.name ?? '—',
    lossType: op.claim.lossType ?? claimFile?.lossType ?? '—',
    noticeAt: notice.at,
    appointmentDate: appt.date,
    appointmentTime: appt.time,
    appointmentAt: appt.at,
    durationMinutes: op.mainAppointment?.estimatedDurationMinutes
      ? String(op.mainAppointment.estimatedDurationMinutes)
      : '',
    locationUrl: op.mainAppointment?.locationUrl ?? op.claim.locationUrl ?? '',
    address: op.mainAppointment?.location ?? op.claim.address ?? '—',
    district: op.claim.district ?? '',
    owner: ownerName || '—',
    insuredApproval: digitalApproved,
    inspectors,
    suppliers,
    alternativeSuppliers: [],
    progressLines,
    risks: hasSupplier
      ? []
      : [{ tone: 'critical' as const, text: 'Tedarikçi ataması bekleniyor.', step: 'supplier' as const }],
    people: [
      {
        initials: initials(ownerName || 'OP'),
        name: ownerName || '—',
        role: 'Dosya Sorumlusu',
        status: ownerName ? ('Atandı' as const) : ('Atanmadı' as const),
      },
      {
        initials: inspectorName ? initials(inspectorName) : 'T',
        name: inspectorName ?? '—',
        role: 'Tespitçi',
        status: hasInspector ? ('Atandı' as const) : ('Atanmadı' as const),
      },
      ...op.assignedSuppliers.slice(0, 2).map((s) => {
        const n = s.name ?? s.companyName ?? 'Tedarikçi';
        return {
          initials: initials(n),
          name: n,
          role: 'Tedarikçi',
          status: 'Atandı' as const,
        };
      }),
    ],
    notes: notes.length > 0 ? notes : [],
    report,
    revisions: PREVIEW.revisions,
    waHistory,
    completedCount,
    totalCount: 8,
    completionPct: Math.round((completedCount / 8) * 100),
    eta: '—',
    stepStatuses,
    preAssignedInspectorId:
      op.assignedInspector?.id ??
      claimFile?.assignedFieldUserId ??
      claimFile?.assignedFieldUser?.id ??
      null,
    preAssignedSupplierIds: op.assignedSuppliers.map((s) => s.id),
  };
}
