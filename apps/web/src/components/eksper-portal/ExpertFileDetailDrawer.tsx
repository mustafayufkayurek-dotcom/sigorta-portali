'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Eye, Loader2 } from 'lucide-react';
import { SlidePanel } from '@/components/SlidePanel';
import { fmtDate, fmtDateTime } from '@/utils/date-helpers';
import { formatClaimSubjectLabel, toTitleCaseTR } from '@/utils/text-helpers';
import { getAccessToken } from '@/utils/auth-session';
import {
  getClaimClosureConditions,
  getFileDocuments,
  type ClaimClosureConditions,
  type FileDocument,
} from '@/utils/fileDocumentApi';
import {
  expertDelayDays,
  expertSlaBadgeClass,
  expertSlaDotClass,
  expertStatusBadgeClass,
} from '@/utils/expert-dosyalar-ui';
import {
  EXPERT_DOC_CATEGORY_LABEL,
  EXPERT_DOC_CATEGORY_ORDER,
  EXPERT_REPORT_IMAGE_LABEL,
  EXPERT_REPORT_IMAGE_ORDER,
  deriveExpertFileStageLabel,
  deriveExpertOperationSummary,
  formatExpertMoney,
  groupExpertDocuments,
  groupExpertReportImages,
  isExpertVisibleNote,
  isKonutBranch,
  maskPersonName,
  personName,
  pickExpertSafeDetail,
  pickExpertSafeFinance,
  presenceClass,
  presenceLabel,
  type ExpertDocCategory,
  type ExpertReportImage,
  type ExpertSafeDetail,
  type ExpertSafeDoc,
  type PresenceTone,
} from '@/utils/expert-drawer-summary';
import { getReportImageUrl } from '@/utils/upload-url';

export type ExpertDrawerFile = {
  id: string;
  fileNo: string;
  claimNo?: string | null;
  lossType?: string | null;
  subject?: string | null;
  description?: string | null;
  insuredName?: string | null;
  createdAt?: string;
  updatedAt?: string | null;
  incidentDate?: string | null;
  notificationDate?: string | null;
  slaDueAt?: string | null;
  delayRisk?: boolean;
  operationStatusLabel?: string | null;
  nextAction?: string | null;
  insuranceCompany?: { id?: string; name?: string } | null;
  currentStatus?: { name?: string; code?: string; color?: string; colorCode?: string } | null;
};

type TabId = 'ozet' | 'belgeler' | 'operasyon' | 'notlar';

type ExpertFileDetailDrawerProps = {
  open: boolean;
  onClose: () => void;
  file: ExpertDrawerFile | null;
  initialTab?: TabId | 'gecmis';
  onOpenDocuments: () => void;
  onOpenNote: () => void;
  /** Değiştiğinde (örn. "Geniş Form" modalından not kaydedilince) Notlar listesi yeniden yüklenir. */
  notesRefreshToken?: number;
};

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1';
const API = API_BASE.endsWith('/api/v1') ? API_BASE : `${API_BASE}/api/v1`;

function authHeaders() {
  const token = getAccessToken();
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

type NoteRow = { id: string; content: string; createdAt: string; noteType?: string };
type ActivityRow = {
  id?: string;
  action?: string;
  title?: string;
  description?: string;
  createdAt?: string;
  occurredAt?: string;
  user?: { firstName?: string; lastName?: string };
  actorName?: string;
  actor?: { firstName?: string; lastName?: string };
};

const TABS: { id: TabId; label: string }[] = [
  { id: 'ozet', label: 'Özet' },
  { id: 'operasyon', label: 'Operasyon Bilgileri' },
  { id: 'belgeler', label: 'Dosya Ekleri' },
  { id: 'notlar', label: 'Notlar' },
];

function normalizeTab(tab?: TabId | 'gecmis'): TabId {
  if (tab === 'gecmis') return 'operasyon';
  if (tab === 'belgeler' || tab === 'operasyon' || tab === 'notlar') return tab;
  return 'ozet';
}

function seedFromListFile(file: ExpertDrawerFile | null): ExpertSafeDetail | null {
  if (!file) return null;
  return {
    id: file.id,
    fileNo: file.fileNo,
    claimNo: file.claimNo,
    lossType: file.lossType,
    subject: file.subject,
    description: file.description,
    insuredName: file.insuredName,
    createdAt: file.createdAt,
    updatedAt: file.updatedAt,
    incidentDate: file.incidentDate,
    notificationDate: file.notificationDate,
    slaDueAt: file.slaDueAt,
    delayRisk: file.delayRisk,
    operationStatusLabel: file.operationStatusLabel,
    nextAction: file.nextAction,
    insuranceCompany: file.insuranceCompany ? { name: file.insuranceCompany.name } : null,
    currentStatus: file.currentStatus
      ? { name: file.currentStatus.name, code: file.currentStatus.code }
      : null,
  };
}

function normalizeDocs(raw: unknown): ExpertSafeDoc[] {
  const list = Array.isArray(raw) ? raw : [];
  return list.map((d: any) => ({
    id: String(d.id),
    fileName: d.fileName ?? d.fileAsset?.fileName ?? null,
    documentType: d.documentType ?? d.documentTypeName ?? d.type ?? null,
    createdAt: d.createdAt ?? null,
    mimeType: d.mimeType ?? d.fileAsset?.mimeType ?? null,
    storageKey: d.storageKey ?? d.fileAsset?.storageKey ?? null,
    url: d.url ?? null,
  }));
}

export function ExpertFileDetailDrawer({
  open,
  onClose,
  file,
  initialTab = 'ozet',
  onOpenDocuments,
  onOpenNote,
  notesRefreshToken,
}: ExpertFileDetailDrawerProps) {
  const [tab, setTab] = useState<TabId>(normalizeTab(initialTab));
  const [detail, setDetail] = useState<ExpertSafeDetail | null>(null);
  const [notes, setNotes] = useState<NoteRow[]>([]);
  const [docs, setDocs] = useState<ExpertSafeDoc[]>([]);
  const [fileDocs, setFileDocs] = useState<FileDocument[]>([]);
  const [reportImages, setReportImages] = useState<ExpertReportImage[]>([]);
  const [expandedPhotoGroups, setExpandedPhotoGroups] = useState<Record<string, boolean>>({});
  const [closure, setClosure] = useState<ClaimClosureConditions | null>(null);
  const [lastActivity, setLastActivity] = useState<ActivityRow | null>(null);
  const [appointmentAt, setAppointmentAt] = useState<string | null>(null);
  const [siteVisitAt, setSiteVisitAt] = useState<string | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [loadingNotes, setLoadingNotes] = useState(false);
  const [noteDraft, setNoteDraft] = useState('');
  const [sendEmailWithNote, setSendEmailWithNote] = useState(false);
  const [noteSaving, setNoteSaving] = useState(false);
  const [noteError, setNoteError] = useState<string | null>(null);
  const [mailResult, setMailResult] = useState<{ tone: 'success' | 'error'; message: string } | null>(null);
  const [previewBusyId, setPreviewBusyId] = useState<string | null>(null);
  const [docPreviewError, setDocPreviewError] = useState<string | null>(null);
  const [notesLoadError, setNotesLoadError] = useState(false);

  useEffect(() => {
    if (open) setTab(normalizeTab(initialTab));
  }, [open, initialTab, file?.id]);

  const loadNotes = useCallback(async (fileId: string) => {
    setLoadingNotes(true);
    setNotesLoadError(false);
    try {
      const res = await fetch(`${API}/claim-files/${fileId}/notes`, { headers: authHeaders() });
      if (!res.ok) throw new Error(String(res.status));
      const body = await res.json();
      const data = body?.data ?? body ?? [];
      const list = Array.isArray(data) ? (data as NoteRow[]) : [];
      setNotes(list.filter(isExpertVisibleNote));
    } catch {
      setNotes([]);
      setNotesLoadError(true);
    } finally {
      setLoadingNotes(false);
    }
  }, []);

  useEffect(() => {
    if (!open || !file?.id) {
      setDetail(null);
      setDocs([]);
      setNotes([]);
      setFileDocs([]);
      setReportImages([]);
      setExpandedPhotoGroups({});
      setClosure(null);
      setLastActivity(null);
      setAppointmentAt(null);
      setSiteVisitAt(null);
      setNoteDraft('');
      setSendEmailWithNote(false);
      setNoteError(null);
      setMailResult(null);
      return;
    }

    setDetail(seedFromListFile(file));
    setLoadingDetail(true);
    const headers = authHeaders();

    Promise.all([
      fetch(`${API}/claim-files/${file.id}`, { headers }).then((r) => (r.ok ? r.json() : null)),
      fetch(`${API}/documents?claimFileId=${encodeURIComponent(file.id)}&limit=50`, { headers }).then((r) =>
        r.ok ? r.json() : null,
      ),
      fetch(`${API}/claim-files/${file.id}/activity-log`, { headers }).then((r) => (r.ok ? r.json() : null)),
      fetch(`${API}/claim-files/${file.id}/appointments`, { headers }).then((r) => (r.ok ? r.json() : null)),
      getClaimClosureConditions(file.id).catch(() => null),
      getFileDocuments('claim_file', file.id).catch(() => [] as FileDocument[]),
    ])
      .then(async ([detailBody, docsBody, activityBody, apptBody, closureConds, entityDocs]) => {
        const raw = (detailBody?.data ?? detailBody) as Record<string, unknown> | null;
        let safe = pickExpertSafeDetail(raw);

        const reportId = safe?.latestRepairReport?.id;
        if (reportId) {
          try {
            const imagesRes = await fetch(`${API}/repair-reports/${reportId}/images`, { headers });
            if (imagesRes.ok) {
              const imagesBody = await imagesRes.json();
              const imagesRaw = (imagesBody?.data ?? imagesBody ?? []) as Array<{
                id: string;
                storageKey: string;
                category?: string | null;
              }>;
              if (Array.isArray(imagesRaw)) {
                setReportImages(
                  imagesRaw.map((img) => ({
                    id: String(img.id),
                    storageKey: img.storageKey,
                    category: img.category ?? null,
                  })),
                );
              }
            }
          } catch {
            /* fotoğraf listesi olmadan devam et */
          }
          try {
            const rrRes = await fetch(`${API}/repair-reports/${reportId}`, { headers });
            if (rrRes.ok) {
              const rrBody = await rrRes.json();
              const rr = (rrBody?.data ?? rrBody) as Record<string, unknown>;
              if (safe?.latestRepairReport) {
                safe = {
                  ...safe,
                  latestRepairReport: {
                    ...safe.latestRepairReport,
                    reportDate: (rr.reportDate as string | null) ?? safe.latestRepairReport.reportDate,
                    findingsText: (rr.findingsText as string | null) ?? safe.latestRepairReport.findingsText,
                    revisedAt: (rr.revisedAt as string | null) ?? safe.latestRepairReport.revisedAt,
                    buildingDamageTotal:
                      typeof rr.buildingDamageTotal === 'number'
                        ? rr.buildingDamageTotal
                        : safe.latestRepairReport.buildingDamageTotal,
                    goodsDamageTotal:
                      typeof rr.goodsDamageTotal === 'number'
                        ? rr.goodsDamageTotal
                        : safe.latestRepairReport.goodsDamageTotal,
                    totalSalesAmount:
                      typeof rr.totalSalesAmount === 'number'
                        ? rr.totalSalesAmount
                        : safe.latestRepairReport.totalSalesAmount,
                  },
                  expertFinance: pickExpertSafeFinance({
                    ...safe.latestRepairReport,
                    ...rr,
                  }),
                };
              }
            }
          } catch {
            /* özet seed kalsın */
          }
        }

        if (safe) setDetail(safe);

        setDocs(normalizeDocs(docsBody?.data ?? docsBody));

        const acts = (activityBody?.data ?? activityBody ?? []) as ActivityRow[];
        setLastActivity(Array.isArray(acts) && acts.length > 0 ? acts[0] : null);

        const appts = (apptBody?.data ?? apptBody ?? []) as Array<{
          scheduledDate?: string;
          scheduledAt?: string;
          completedAt?: string;
          checkedInAt?: string;
          status?: string;
        }>;
        if (Array.isArray(appts) && appts.length > 0) {
          const primary = appts[0];
          setAppointmentAt(primary.scheduledDate ?? primary.scheduledAt ?? null);
          setSiteVisitAt(primary.checkedInAt ?? primary.completedAt ?? null);
        } else {
          setAppointmentAt(null);
          setSiteVisitAt(null);
        }

        const closureRaw = closureConds as ClaimClosureConditions | { data?: ClaimClosureConditions } | null;
        setClosure(
          closureRaw && typeof closureRaw === 'object' && 'muvafakatnameDigitallyApproved' in closureRaw
            ? (closureRaw as ClaimClosureConditions)
            : (closureRaw as { data?: ClaimClosureConditions } | null)?.data ?? null,
        );

        const entityRaw = entityDocs as FileDocument[] | { data?: FileDocument[] };
        const entityList = Array.isArray(entityRaw)
          ? entityRaw
          : Array.isArray(entityRaw?.data)
            ? entityRaw.data
            : [];
        setFileDocs(entityList);
      })
      .catch(() => {
        /* seed kalsın */
      })
      .finally(() => setLoadingDetail(false));
  }, [open, file]);

  useEffect(() => {
    if (!open || !file?.id || tab !== 'notlar') return;
    void loadNotes(file.id);
    // notesRefreshToken: "Geniş Form" modalından not kaydedilince drawer açıkken listeyi tazele.
  }, [open, file?.id, tab, loadNotes, notesRefreshToken]);

  const view = detail ?? seedFromListFile(file);
  const subject = formatClaimSubjectLabel(view?.lossType, undefined, view?.subject ?? undefined);
  const delayDays = expertDelayDays({
    slaDueAt: view?.slaDueAt,
    delayRisk: view?.delayRisk,
  });
  const delayTone =
    delayDays == null ? 'muted' : delayDays > 0 ? 'red' : 'green';

  const lastActivityTitle =
    lastActivity?.title ||
    lastActivity?.action ||
    lastActivity?.description ||
    null;

  const op = view ? deriveExpertOperationSummary(view, lastActivityTitle) : null;
  const fileStage = view ? deriveExpertFileStageLabel(view) : '—';
  const docGroups = useMemo(() => groupExpertDocuments(docs), [docs]);
  const photoGroups = useMemo(() => groupExpertReportImages(reportImages), [reportImages]);
  const showKonutDamage = isKonutBranch(view);
  const finance = view?.expertFinance ?? null;

  const photoTone: PresenceTone = docGroups.hasarFotograflari.length > 0 ? 'ok' : 'missing';
  const muvafakatTone: PresenceTone =
    closure?.muvafakatnameDigitallyApproved ||
    closure?.muvafakatnamePhysicallyUploaded ||
    closure?.muvafakatnameStatus === 'digitally_approved' ||
    closure?.muvafakatnameStatus === 'physically_uploaded' ||
    fileDocs.some(
      (d) =>
        d.documentKind === 'muvafakatname' &&
        (d.status === 'digitally_approved' || d.status === 'physically_uploaded'),
    ) ||
    docGroups.muvafakatname.length > 0
      ? 'ok'
      : 'pending';
  const digitalTone: PresenceTone =
    closure?.muvafakatnameDigitallyApproved ||
    fileDocs.some((d) => d.status === 'digitally_approved')
      ? 'ok'
      : 'pending';

  const totalOpDocs =
    docGroups.hasarFotograflari.length + docGroups.muvafakatname.length + docGroups.dijitalOnay.length;

  const addressLine = view?.propertyAddress?.addressLine || view?.customer?.address || '—';
  const city = view?.propertyAddress?.city || view?.customer?.city || '—';
  const district = view?.propertyAddress?.district || view?.customer?.district || '—';
  const expertNote = view?.latestRepairReport?.findingsText?.trim() || view?.description?.trim() || '—';

  const lastOpAt =
    lastActivity?.occurredAt ||
    lastActivity?.createdAt ||
    view?.lastHumanActionAt ||
    view?.lastActivityAt ||
    view?.updatedAt ||
    null;
  const lastOpUser =
    lastActivity?.actorName ||
    personName(lastActivity?.actor) ||
    personName(lastActivity?.user) ||
    personName(view?.currentResponsibleUser);
  const meridyenFileOwner = personName(view?.assignedOfficeUser);
  const fieldInspectorName = maskPersonName(view?.assignedFieldUser);

  const openDoc = async (doc: ExpertSafeDoc) => {
    setPreviewBusyId(doc.id);
    setDocPreviewError(null);
    try {
      if (doc.url) {
        window.open(doc.url, '_blank', 'noopener,noreferrer');
        return;
      }
      if (!doc.storageKey) {
        setDocPreviewError('Bu evrak için görüntüleme bağlantısı bulunamadı.');
        return;
      }
      const res = await fetch(
        `${API}/uploads/signed-url?storageKey=${encodeURIComponent(doc.storageKey)}`,
        { headers: authHeaders() },
      );
      if (!res.ok) {
        setDocPreviewError('Evrak açılamadı, lütfen tekrar deneyin.');
        return;
      }
      const body = await res.json();
      const url = body?.data?.url ?? body?.url;
      if (url) {
        window.open(url, '_blank', 'noopener,noreferrer');
      } else {
        setDocPreviewError('Evrak açılamadı, lütfen tekrar deneyin.');
      }
    } catch {
      setDocPreviewError('Evrak açılamadı, lütfen tekrar deneyin.');
    } finally {
      setPreviewBusyId(null);
    }
  };

  const saveNote = async () => {
    if (!file?.id) return;
    const text = toTitleCaseTR(noteDraft.trim());
    if (!text) {
      setNoteError('Not metni zorunludur.');
      return;
    }
    setNoteSaving(true);
    setNoteError(null);
    setMailResult(null);
    try {
      const res = await fetch(`${API}/claim-files/${file.id}/notes`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ content: text, noteType: 'general' }),
      });
      if (!res.ok) {
        const fallback = await fetch(`${API}/notes`, {
          method: 'POST',
          headers: authHeaders(),
          body: JSON.stringify({ claimFileId: file.id, content: text, noteType: 'general' }),
        });
        if (!fallback.ok) throw new Error('Not kaydedilemedi.');
      }

      if (sendEmailWithNote) {
        const mailRes = await fetch(`${API}/claim-files/${file.id}/responsible-email`, {
          method: 'POST',
          headers: authHeaders(),
          body: JSON.stringify({ message: text }),
        });
        const body = await mailRes.json().catch(() => ({}));
        if (!mailRes.ok || body?.success === false) {
          throw new Error(
            body?.message || body?.data?.errorMsg || 'Not kaydedildi; e-posta gönderilemedi.',
          );
        }
        setMailResult({ tone: 'success', message: 'Not kaydedildi ve e-posta gönderildi.' });
      }

      setNoteDraft('');
      setSendEmailWithNote(false);
      await loadNotes(file.id);
    } catch (e) {
      setNoteError(e instanceof Error ? e.message : 'Not kaydedilemedi.');
    } finally {
      setNoteSaving(false);
    }
  };

  const approvalToneClass = (status?: string) => {
    if (!status) return 'text-slate-700';
    if (/revizyon/i.test(status)) return 'text-amber-700';
    if (/bekleniyor/i.test(status)) return 'text-violet-700';
    if (/onaylandı|onaylandi/i.test(status)) return 'text-emerald-700';
    return 'text-slate-700';
  };

  return (
    <SlidePanel open={open} onClose={onClose} width={480} scrollContent={false}>
      <div className="flex h-full min-h-0 flex-col" data-testid="eksper-file-detail-drawer">
        <div className="flex shrink-0 items-start justify-between border-b border-slate-100 px-5 py-3.5">
          <div className="min-w-0">
            <p className="text-[11px] font-medium tracking-wide text-slate-400">Dosya Operasyon Özeti</p>
            <h3 className="mt-0.5 truncate text-[15px] font-semibold text-slate-900">{view?.fileNo ?? '—'}</h3>
          </div>
          <div className="flex items-center gap-2">
            {view && fileStage !== '—' ? (
              <span className={expertStatusBadgeClass(fileStage)}>{fileStage}</span>
            ) : null}
            <button
              type="button"
              onClick={onClose}
              className="flex h-7 w-7 items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              aria-label="Kapat"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <div className="flex shrink-0 gap-0.5 border-b border-slate-100 px-3 pt-1.5">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`rounded-t-md px-3 py-2 text-xs font-semibold transition ${
                tab === t.id ? 'border-b-2 border-brand-600 text-blue-700' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-3.5">
          {!view ? (
            <p className="text-sm text-slate-500">Dosya seçilmedi.</p>
          ) : tab === 'ozet' ? (
            <div className="space-y-3.5">
              {loadingDetail ? (
                <p className="text-[11px] text-slate-400">Güncel operasyon bilgileri yükleniyor…</p>
              ) : null}

              <Section title="Dosya Genel Durumu">
                <div className="grid grid-cols-2 gap-x-3 gap-y-2">
                  <Field label="Hasar Dosya No" value={view.fileNo} />
                  <Field label="Sigorta Şirketi" value={view.insuranceCompany?.name || '—'} />
                  <Field label="Dosya Konusu" value={subject || '—'} />
                  <Field
                    label="Dosya Durumu"
                    value={<span className={expertStatusBadgeClass(fileStage)}>{fileStage}</span>}
                  />
                  <Field
                    label="Gecikme Gün"
                    value={
                      <span className={expertSlaBadgeClass(delayTone)}>
                        <span className={`inline-block h-1.5 w-1.5 rounded-full ${expertSlaDotClass(delayTone)}`} />
                        {delayDays == null ? '—' : delayDays}
                      </span>
                    }
                  />
                  <Field label="Meridyen Dosya Sorumlusu" value={meridyenFileOwner} />
                </div>
              </Section>

              <Section title="Onay Analizi">
                <div className="grid grid-cols-2 gap-x-3 gap-y-2">
                  <Field
                    label="Onay Bekliyor mu"
                    value={
                      <span className={presenceClass(op?.waitingApproval ? 'pending' : 'ok')}>
                        {op?.waitingApproval ? '✕ Evet — Onay Bekleniyor' : '✓ Hayır'}
                      </span>
                    }
                  />
                  <Field
                    label="Revizyon İstendi mi"
                    value={
                      <span className={presenceClass(op?.revisionRequested ? 'pending' : 'ok')}>
                        {op?.revisionRequested ? '✕ Evet — Revizyon Bekleniyor' : '✓ Hayır'}
                      </span>
                    }
                  />
                  <Field
                    label="Eksper Onay Durumu"
                    value={
                      <span className={`font-semibold ${approvalToneClass(op?.expertApprovalStatus)}`}>
                        {op?.expertApprovalStatus ?? '—'}
                      </span>
                    }
                  />
                  <Field
                    label="Eksper Onay Tarihi"
                    value={op?.expertApprovalDate ? fmtDate(op.expertApprovalDate) : '—'}
                  />
                  <Field label="Son İşlem" value={op?.lastActionLabel ?? '—'} className="col-span-2" />
                  <Field label="Bekleyen Aksiyon" value={op?.pendingActionLabel ?? '—'} className="col-span-2" />
                  {lastOpAt ? (
                    <p className="col-span-2 text-[11px] text-slate-400">
                      {fmtDateTime(lastOpAt)}
                      {lastOpUser && lastOpUser !== '—' ? ` · ${lastOpUser}` : ''}
                    </p>
                  ) : null}
                </div>
              </Section>

              {(showKonutDamage || finance) ? (
                <Section title="Rapor Özeti">
                  <div className="grid grid-cols-2 gap-x-3 gap-y-3">
                    {showKonutDamage ? (
                      <>
                        <Field
                          label="Bina Hasarı"
                          value={formatExpertMoney(finance?.buildingDamageTotal)}
                          className="text-center"
                        />
                        <Field
                          label="Eşya Hasarı"
                          value={formatExpertMoney(finance?.goodsDamageTotal)}
                          className="text-center"
                        />
                      </>
                    ) : null}
                    <div className="col-span-2 border-t border-slate-200 pt-2 text-center">
                      <p className="text-[10.5px] font-medium text-slate-400">Toplam Rapor Bedeli</p>
                      <p className="mt-0.5 text-[15px] font-semibold text-slate-900">
                        {formatExpertMoney(finance?.totalFileAmount ?? finance?.repairAmount)}
                      </p>
                    </div>
                  </div>
                </Section>
              ) : null}

              <Section title="Evrak Durumu">
                <ul className="space-y-1.5 text-[12.5px]">
                  <EvrakRow
                    label="Hasar Fotoğrafları"
                    text={presenceLabel(photoTone, 'Tamamlandı', 'Eksik')}
                    tone={photoTone}
                  />
                  <EvrakRow
                    label="Muvafakatname"
                    text={presenceLabel(muvafakatTone, 'Tamamlandı', 'Bekleniyor')}
                    tone={muvafakatTone}
                  />
                  <EvrakRow
                    label="Dijital Onay"
                    text={presenceLabel(digitalTone, 'Tamamlandı', 'Bekleniyor')}
                    tone={digitalTone}
                  />
                </ul>
              </Section>

              <Section title="Eksper Notu">
                <p className="text-[12.5px] font-medium text-slate-800">
                  {expertNote && expertNote !== '—' ? expertNote : 'Henüz eksper notu yok.'}
                </p>
              </Section>
            </div>
          ) : tab === 'belgeler' ? (
            <div className="space-y-3">
              <Section title="Evrak Süreçleri">
                <ul className="space-y-2 text-[12.5px]">
                  <EvrakRow
                    label="Hasar Fotoğrafları"
                    text={photoTone === 'ok' ? 'Tamamlandı' : 'Eksik'}
                    tone={photoTone}
                  />
                  <EvrakRow
                    label="Muvafakatname"
                    text={muvafakatTone === 'ok' ? 'Tamamlandı' : 'Bekleniyor'}
                    tone={muvafakatTone}
                  />
                  <EvrakRow
                    label="Dijital Onay"
                    text={digitalTone === 'ok' ? 'Tamamlandı' : 'Bekleniyor'}
                    tone={digitalTone}
                  />
                </ul>
              </Section>

              {EXPERT_REPORT_IMAGE_ORDER.some((cat) => photoGroups[cat].length > 0) ? (
                <div className="space-y-3">
                  <p className="text-sm font-semibold text-slate-800">Onarım Raporu Fotoğrafları</p>
                  {EXPERT_REPORT_IMAGE_ORDER.map((cat) => (
                    <ReportPhotoGroup
                      key={cat}
                      label={EXPERT_REPORT_IMAGE_LABEL[cat]}
                      images={photoGroups[cat]}
                      expanded={Boolean(expandedPhotoGroups[cat])}
                      onToggleExpand={() =>
                        setExpandedPhotoGroups((prev) => ({ ...prev, [cat]: !prev[cat] }))
                      }
                    />
                  ))}
                </div>
              ) : null}

              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-slate-800">Yüklenen Evraklar</p>
                <button
                  type="button"
                  className="text-xs font-semibold text-brand-600 hover:text-blue-800"
                  onClick={onOpenDocuments}
                >
                  Evrak Yükle
                </button>
              </div>

              {docPreviewError ? (
                <p className="text-xs font-medium text-red-600">{docPreviewError}</p>
              ) : null}

              {loadingDetail ? (
                <p className="text-sm text-slate-400">Yükleniyor…</p>
              ) : totalOpDocs === 0 ? (
                <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-4 text-sm text-slate-600">
                  Bu dosyada henüz hasar fotoğrafı, muvafakatname veya dijital onay evrakı yok.
                </div>
              ) : (
                <div className="space-y-3">
                  {EXPERT_DOC_CATEGORY_ORDER.map((cat) => (
                    <DocCategoryBlock
                      key={cat}
                      category={cat}
                      items={docGroups[cat]}
                      busyId={previewBusyId}
                      onOpen={(d) => void openDoc(d)}
                    />
                  ))}
                </div>
              )}

              {fileDocs.length > 0 ? (
                <div className="rounded-lg border border-slate-200 px-3 py-2.5">
                  <p className="text-[11px] font-semibold tracking-wide text-slate-400">
                    Muvafakat / Dijital Onay Kayıtları
                  </p>
                  <ul className="mt-2 space-y-1.5">
                    {fileDocs.map((fd) => (
                      <li key={fd.id} className="flex items-center justify-between gap-2 text-xs">
                        <span className="font-medium text-slate-800">
                          {fd.documentKind === 'muvafakatname' ? 'Muvafakatname' : 'Evrak'}
                        </span>
                        <span className="text-slate-500">
                          {{
                            draft: 'Taslak',
                            sent: 'Gönderildi',
                            viewed: 'Görüntülendi',
                            digitally_approved: 'Dijital Onaylı',
                            physically_uploaded: 'Yüklendi',
                          }[fd.status] ?? fd.status.replace(/_/g, ' ')}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          ) : tab === 'operasyon' ? (
            <div className="space-y-3.5">
              <Section title="Operasyon Bilgileri">
                <div className="grid grid-cols-2 gap-x-3 gap-y-2">
                  <Field
                    label="Randevu Tarihi"
                    value={appointmentAt ? fmtDateTime(appointmentAt) : '—'}
                  />
                  <Field
                    label="Saha Ziyaret Tarihi"
                    value={siteVisitAt ? fmtDateTime(siteVisitAt) : '—'}
                  />
                  <Field
                    label="Hasar Tespiti Yapıldı mı"
                    value={
                      <span className={presenceClass(op?.inspectionDone ? 'ok' : 'pending')}>
                        {op?.inspectionDone ? '✓ Yapıldı' : '✕ Bekleniyor'}
                      </span>
                    }
                  />
                  <Field
                    label="Hasar Tespit Tarihi"
                    value={op?.inspectionDate ? fmtDate(op.inspectionDate) : view.incidentDate ? fmtDate(view.incidentDate) : '—'}
                  />
                  <Field
                    label="Dosya İhbar Tarihi"
                    value={op?.notificationDate ? fmtDate(op.notificationDate) : '—'}
                  />
                  <Field
                    label="Onarım Durumu"
                    value={
                      <span
                        className={`font-semibold ${
                          op?.repairStatus === 'Onarım Tamamlandı'
                            ? 'text-emerald-700'
                            : op?.repairStatus === 'Onarım Devam Ediyor'
                              ? 'text-blue-700'
                              : 'text-slate-700'
                        }`}
                      >
                        {op?.repairStatus ?? '—'}
                      </span>
                    }
                  />
                  <Field label="Dosya Sorumlusu" value={meridyenFileOwner} />
                  <Field
                    label="Son Güncelleme"
                    value={view.updatedAt ? fmtDateTime(view.updatedAt) : lastOpAt ? fmtDateTime(lastOpAt) : '—'}
                  />
                </div>
              </Section>

              <Section title="Saha Bilgileri">
                <div className="grid grid-cols-2 gap-x-3 gap-y-2">
                  <Field label="Hasar Adresi" value={addressLine} className="col-span-2" />
                  <Field label="İl" value={city} />
                  <Field label="İlçe" value={district} />
                  <Field label="Hasar Tespiti Yapan" value={fieldInspectorName} className="col-span-2" />
                </div>
              </Section>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm font-semibold text-slate-800">Notlar</p>
              <div className="rounded-lg border border-slate-200 p-3">
                <p className="mb-2 text-xs text-slate-500">
                  Meridyen Dosya Sorumlusu: <span className="font-semibold text-slate-700">{meridyenFileOwner}</span>
                </p>
                <textarea
                  value={noteDraft}
                  onChange={(e) => {
                    setNoteDraft(e.target.value);
                    setMailResult(null);
                  }}
                  onBlur={(e) => {
                    const v = toTitleCaseTR(e.target.value.trim());
                    if (v) setNoteDraft(v);
                  }}
                  rows={3}
                  placeholder="Notunuzu Yazın…"
                  className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-800 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                />
                <label className="mt-2 flex cursor-pointer items-start gap-2 rounded-md border border-slate-200 bg-slate-50/80 px-2.5 py-2">
                  <input
                    type="checkbox"
                    checked={sendEmailWithNote}
                    onChange={(e) => setSendEmailWithNote(e.target.checked)}
                    disabled={meridyenFileOwner === '—'}
                    className="mt-0.5 h-3.5 w-3.5 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                  />
                  <span className="min-w-0 text-xs text-slate-700">
                    <span className="font-medium">Dosya Sorumlusuna E-posta Gönder</span>
                    <span className="mt-0.5 block text-slate-500">İsteğe bağlıdır.</span>
                  </span>
                </label>
                {noteError ? <p className="mt-1 text-xs text-status-danger">{noteError}</p> : null}
                {mailResult ? (
                  <p className={`mt-1 text-xs ${mailResult.tone === 'success' ? 'text-status-success' : 'text-status-danger'}`}>
                    {mailResult.message}
                  </p>
                ) : null}
                <div className="mt-2 flex flex-wrap justify-end gap-2">
                  <button
                    type="button"
                    onClick={onOpenNote}
                    className="rounded-md px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                  >
                    Geniş Form
                  </button>
                  <button
                    type="button"
                    disabled={noteSaving}
                    onClick={() => void saveNote()}
                    className="inline-flex items-center gap-1.5 rounded-md bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
                  >
                    {noteSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                    {noteSaving ? 'Kaydediliyor…' : sendEmailWithNote ? 'Kaydet Ve Gönder' : 'Not Yaz'}
                  </button>
                </div>
              </div>

              {loadingNotes ? (
                <p className="text-sm text-slate-400">Yükleniyor…</p>
              ) : notesLoadError ? (
                <p className="text-sm text-red-600">Notlar yüklenemedi. Lütfen tekrar deneyin.</p>
              ) : notes.length === 0 ? (
                <p className="text-sm text-slate-400">Henüz eksper notu yok.</p>
              ) : (
                <ul className="space-y-2">
                  {notes.map((n) => (
                    <li key={n.id} className="rounded-lg border border-slate-200 px-3 py-2.5 text-xs">
                      <p className="whitespace-pre-wrap text-slate-800">{n.content}</p>
                      <p className="mt-1 text-slate-400">{n.createdAt ? fmtDateTime(n.createdAt) : ''}</p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>

        <div className="shrink-0 border-t border-slate-100 px-5 py-3">
          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"
          >
            Kapat
          </button>
        </div>
      </div>
    </SlidePanel>
  );
}

function DocCategoryBlock({
  category,
  items,
  busyId,
  onOpen,
}: {
  category: ExpertDocCategory;
  items: ExpertSafeDoc[];
  busyId: string | null;
  onOpen: (doc: ExpertSafeDoc) => void;
}) {
  if (items.length === 0) return null;
  return (
    <section>
      <div className="mb-1.5 flex items-center justify-between">
        <h4 className="text-[11px] font-semibold tracking-wide text-slate-400">
          {EXPERT_DOC_CATEGORY_LABEL[category]}
        </h4>
        <span className="text-[11px] text-slate-400">{items.length}</span>
      </div>
      <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200">
        {items.map((d) => (
          <li key={d.id} className="flex items-center justify-between gap-2 px-3 py-2 text-xs">
            <div className="min-w-0">
              <p className="truncate font-medium text-slate-800">{d.fileName ?? 'Evrak'}</p>
              <p className="mt-0.5 text-slate-400">
                {d.documentType ?? '—'}
                {d.createdAt ? ` · ${fmtDate(d.createdAt)}` : ''}
              </p>
            </div>
            <button
              type="button"
              onClick={() => onOpen(d)}
              disabled={!d.storageKey && !d.url}
              className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-40"
              title="Görüntüle"
              aria-label="Görüntüle"
            >
              {busyId === d.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Eye className="h-3.5 w-3.5" strokeWidth={1.75} />}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

const PHOTO_PREVIEW_LIMIT = 3;

function ReportPhotoGroup({
  label,
  images,
  expanded,
  onToggleExpand,
}: {
  label: string;
  images: ExpertReportImage[];
  expanded: boolean;
  onToggleExpand: () => void;
}) {
  if (images.length === 0) return null;
  const shown = expanded ? images : images.slice(0, PHOTO_PREVIEW_LIMIT);
  const remaining = images.length - shown.length;

  return (
    <section>
      <div className="mb-1.5 flex items-center justify-between">
        <h4 className="text-[11px] font-semibold tracking-wide text-slate-400">{label}</h4>
        <span className="text-[11px] text-slate-400">{images.length}</span>
      </div>
      <div className="grid grid-cols-4 gap-1.5">
        {shown.map((img) => (
          <button
            key={img.id}
            type="button"
            onClick={() => window.open(getReportImageUrl(img.storageKey), '_blank', 'noopener,noreferrer')}
            className="aspect-square overflow-hidden rounded-md border border-slate-200 bg-slate-100"
            title="Büyük Görüntüle"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={getReportImageUrl(img.storageKey)}
              alt={label}
              className="h-full w-full object-cover"
              loading="lazy"
            />
          </button>
        ))}
        {!expanded && remaining > 0 ? (
          <button
            type="button"
            onClick={onToggleExpand}
            className="flex aspect-square items-center justify-center rounded-md border border-dashed border-slate-300 text-[11px] font-semibold text-slate-500 hover:bg-slate-50"
          >
            +{remaining}
          </button>
        ) : null}
      </div>
    </section>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h4 className="mb-1.5 text-[11px] font-semibold tracking-[0.04em] text-slate-400">{title}</h4>
      <div className="rounded-lg border border-slate-200 bg-slate-50/70 px-3 py-2.5">{children}</div>
    </section>
  );
}

function Field({
  label,
  value,
  className = '',
}: {
  label: string;
  value: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`min-w-0 ${className}`}>
      <p className="text-[10.5px] font-medium text-slate-400">{label}</p>
      <div className="mt-0.5 break-words text-[12.5px] font-medium text-slate-800">{value}</div>
    </div>
  );
}

function EvrakRow({ label, text, tone }: { label: string; text: string; tone: PresenceTone }) {
  return (
    <li className="flex items-center justify-between gap-3">
      <span className="text-slate-600">{label}</span>
      <span className={`font-semibold ${presenceClass(tone)}`}>{text}</span>
    </li>
  );
}
