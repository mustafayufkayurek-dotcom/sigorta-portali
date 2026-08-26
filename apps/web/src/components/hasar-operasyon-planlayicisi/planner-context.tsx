'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import axios from 'axios';
import { API, authHeader } from '@/utils/api';
import {
  HASAR_WA_TEMPLATE_TYPES,
  interpolateHasarTemplate,
  loadHasarWaTemplates,
  pickTemplate,
  templateTypeForRecipient,
  type HasarTemplateRecord,
} from './hasar-templates';
import { normalizeTrDateValue } from '@/utils/tr-date-input';
import { buildSupplierTaskMapFromNotes } from '@/utils/hasar-supplier-tasks';
import { isLegacyOpsCatchupBypassActive } from '@/utils/whatsapp-sent-confirm-gate';
import { reportCaughtError } from '@/utils/report-caught-error';
import { getMandatoryChecks, missingMandatoryLabels } from './mandatory-fields';
import type { StepId } from './types';
import {
  previewSnapshot,
  type PlannerClaimSnapshot,
  type PlannerMode,
} from './claim-snapshot';
import {
  PLANNER_DEFAULT_APPROVAL_AUTHORITY,
  resolvePlannerApprovalParty,
} from './planner-approval-party';

export type SaveStepResult = {
  ok: boolean;
  message: string;
  missing?: string[];
};

type PlannerDraft = {
  mode: PlannerMode;
  canEdit: boolean;
  claim: PlannerClaimSnapshot;
  setClaim: (v: PlannerClaimSnapshot | ((p: PlannerClaimSnapshot) => PlannerClaimSnapshot)) => void;
  refreshClaim: () => Promise<void>;
  meetingNote: string;
  setMeetingNote: (v: string) => void;
  apptNote: string;
  setApptNote: (v: string) => void;
  inspectorNote: string;
  setInspectorNote: (v: string) => void;
  insuredApproved: boolean;
  setInsuredApproved: (v: boolean) => void;
  assignedInspectorId: string | null;
  setAssignedInspectorId: (v: string | null) => void;
  assignedSupplierIds: string[];
  setAssignedSupplierIds: (v: string[] | ((prev: string[]) => string[])) => void;
  supplierTasks: Record<string, string>;
  setSupplierTasks: (
    v: Record<string, string> | ((prev: Record<string, string>) => Record<string, string>),
  ) => void;
  waRecipientType: string;
  setWaRecipientType: (v: string) => void;
  waTemplateType: string;
  setWaTemplateType: (v: string) => void;
  waBody: string;
  setWaBody: (v: string) => void;
  digitalFormType: string;
  setDigitalFormType: (v: string) => void;
  approvalAuthority: string;
  setApprovalAuthority: (v: string) => void;
  emailTo: string;
  setEmailTo: (v: string) => void;
  emailSubject: string;
  setEmailSubject: (v: string) => void;
  approverType: string;
  setApproverType: (v: string) => void;
  approverName: string;
  setApproverName: (v: string) => void;
  meridyenNote: string;
  setMeridyenNote: (v: string) => void;
  templates: HasarTemplateRecord[];
  templatesFromSettings: boolean;
  templatesLoading: boolean;
  buildInsuredApptMessage: () => string;
  buildInspectorMessage: () => string;
  buildVendorTaskMessage: (vendorName: string, task: string) => string;
  applyWaTemplateForRecipient: (recipientType: string) => string;
  validateStep: (step: StepId) => { ok: boolean; missing: string[] };
  saveStep: (step: StepId) => Promise<SaveStepResult>;
  recordWhatsAppContact: (input?: {
    status?: 'opened' | 'sent' | 'ready';
    recipientType?: 'insured' | 'adjuster' | 'vendor';
    recipientName?: string | null;
    phone?: string;
    message?: string;
    templateType?: string;
    purpose?: 'inspection' | 'repair';
  }) => Promise<SaveStepResult>;
  saving: boolean;
  onGoToReports: (() => void) | null;
};

const PlannerCtx = createContext<PlannerDraft | null>(null);

type ProviderProps = {
  children: ReactNode;
  mode?: PlannerMode;
  canEdit?: boolean;
  initialClaim?: PlannerClaimSnapshot;
  claimId?: string | null;
  onRefresh?: () => Promise<PlannerClaimSnapshot | void>;
  onGoToReports?: () => void;
};

export function PlannerProvider({
  children,
  mode = 'preview',
  canEdit = true,
  initialClaim,
  claimId = null,
  onRefresh,
  onGoToReports,
}: ProviderProps) {
  const [claim, setClaim] = useState<PlannerClaimSnapshot>(
    initialClaim ?? previewSnapshot(),
  );
  const [meetingNote, setMeetingNote] = useState(
    mode === 'preview' ? 'Sigortalı sabah saatini tercih etti.' : '',
  );
  const [apptNote, setApptNote] = useState(mode === 'preview' ? 'Kapı kodu: 4521' : '');
  const [inspectorNote, setInspectorNote] = useState('');
  const [insuredApproved, setInsuredApproved] = useState(claim.insuredApproval);
  const [assignedInspectorId, setAssignedInspectorId] = useState<string | null>(
    mode === 'preview' ? 'i1' : null,
  );
  const [assignedSupplierIds, setAssignedSupplierIds] = useState<string[]>([]);
  const [supplierTasks, setSupplierTasks] = useState<Record<string, string>>({});
  const [waRecipientType, setWaRecipientType] = useState('Sigortalı');
  const [waTemplateType, setWaTemplateType] = useState<string>(
    HASAR_WA_TEMPLATE_TYPES.insuredAppointment,
  );
  const [waBody, setWaBody] = useState('');
  const [digitalFormType, setDigitalFormType] = useState('Mutabakat / Muvafakat');
  const [approvalAuthority, setApprovalAuthorityState] = useState(PLANNER_DEFAULT_APPROVAL_AUTHORITY);
  const [emailTo, setEmailTo] = useState('');
  const [emailSubject, setEmailSubject] = useState('');
  const [approverType, setApproverType] = useState('Eksper');
  const [approverName, setApproverName] = useState('');
  const [meridyenNote, setMeridyenNote] = useState('');
  const [templates, setTemplates] = useState<HasarTemplateRecord[]>([]);
  const [templatesFromSettings, setTemplatesFromSettings] = useState(false);
  const [templatesLoading, setTemplatesLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const saveLock = useRef(false);

  /** Soft refresh’te form alanlarını sıfırlama — yalnızca dosya / ilk hydrate. */
  const formHydratedForClaim = useRef<string | null>(null);

  useEffect(() => {
    formHydratedForClaim.current = null;
  }, [claimId]);

  useEffect(() => {
    if (!initialClaim) return;
    setClaim(initialClaim);
    if (mode === 'live') {
      if (formHydratedForClaim.current === claimId) return;
      formHydratedForClaim.current = claimId;
      setAssignedSupplierIds(initialClaim.preAssignedSupplierIds);
      setAssignedInspectorId(initialClaim.preAssignedInspectorId);
      // Görev tanımlarını kayıtlı note’tan geri yükle (Kaydet sonrası boş kalmasın)
      setSupplierTasks(buildSupplierTaskMapFromNotes(initialClaim.suppliers));
      setApptNote('');
      setApprovalAuthorityState(PLANNER_DEFAULT_APPROVAL_AUTHORITY);
      const party = resolvePlannerApprovalParty(PLANNER_DEFAULT_APPROVAL_AUTHORITY, {
        expertOfficeName: initialClaim.expertOfficeName,
        expertOfficeEmail: initialClaim.expertOfficeEmail,
        insurerName: initialClaim.insurer,
        insurerEmail: initialClaim.insurerEmail,
      });
      setEmailTo(party.email);
      setEmailSubject(
        `${initialClaim.fileNo} — Onay Talebi Revizyon ${initialClaim.report.revision}`,
      );
    } else {
      setAssignedInspectorId(initialClaim.preAssignedInspectorId);
      const previewParty = resolvePlannerApprovalParty(PLANNER_DEFAULT_APPROVAL_AUTHORITY, {
        expertOfficeName: initialClaim.expertOfficeName,
        expertOfficeEmail: initialClaim.expertOfficeEmail,
        insurerName: initialClaim.insurer,
        insurerEmail: initialClaim.insurerEmail,
      });
      setEmailTo(previewParty.email);
    }
  }, [initialClaim, mode, claimId]);

  const baseVars = useMemo(
    () => ({
      musteriAdi: claim.insuredName,
      dosyaNo: claim.fileNo,
      sirketAdi: claim.insurer,
      hasarAdresi: claim.address,
      randevuTarih: claim.appointmentDate,
      randevuSaat: claim.appointmentTime,
      tahminiSure: claim.durationMinutes ? `${claim.durationMinutes} Dakika` : '',
      isTanimi: claim.lossType,
    }),
    [claim],
  );

  const waSeededForClaim = useRef<string | null>(null);

  useEffect(() => {
    waSeededForClaim.current = null;
  }, [claimId]);

  useEffect(() => {
    let cancelled = false;
    setTemplatesLoading(true);
    loadHasarWaTemplates().then((result) => {
      if (cancelled) return;
      setTemplates(result.templates);
      setTemplatesFromSettings(result.fromSettings);
      setTemplatesLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [claimId]);

  useEffect(() => {
    if (templatesLoading || templates.length === 0 || !claim.fileNo) return;
    if (waSeededForClaim.current === claimId) return;
    waSeededForClaim.current = claimId;
    const insured = pickTemplate(templates, HASAR_WA_TEMPLATE_TYPES.insuredAppointment);
    setWaBody(interpolateHasarTemplate(insured.content, baseVars));
  }, [templates, templatesLoading, claim.fileNo, claimId, baseVars]);

  const refreshClaim = useCallback(async () => {
    if (onRefresh) {
      const next = await onRefresh();
      if (next) setClaim(next);
    }
  }, [onRefresh]);

  const buildInsuredApptMessage = useCallback(() => {
    const t = pickTemplate(templates, HASAR_WA_TEMPLATE_TYPES.insuredAppointment);
    return interpolateHasarTemplate(t.content, baseVars);
  }, [templates, baseVars]);

  const buildInspectorMessage = useCallback(() => {
    const t = pickTemplate(templates, HASAR_WA_TEMPLATE_TYPES.inspectorAppointment);
    return interpolateHasarTemplate(t.content, baseVars);
  }, [templates, baseVars]);

  const buildVendorTaskMessage = useCallback(
    (vendorName: string, task: string) => {
      const t = pickTemplate(templates, HASAR_WA_TEMPLATE_TYPES.vendorAssignment);
      return interpolateHasarTemplate(t.content, {
        ...baseVars,
        tedarikciAdi: vendorName,
        isTanimi: task || claim.lossType,
      });
    },
    [templates, baseVars, claim.lossType],
  );

  const applyWaTemplateForRecipient = useCallback(
    (recipientType: string) => {
      const type = templateTypeForRecipient(recipientType);
      const t = pickTemplate(templates, type);
      return interpolateHasarTemplate(t.content, baseVars);
    },
    [templates, baseVars],
  );

  const resolveWaPhone = useCallback(() => {
    if (waRecipientType === 'Sigortalı') return claim.insuredPhone;
    if (waRecipientType === 'Tespitçi') {
      const insp = claim.inspectors.find((i) => i.id === assignedInspectorId);
      return insp?.phone ?? '';
    }
    if (waRecipientType === 'Tedarikçi') {
      const first = claim.suppliers.find((s) => assignedSupplierIds.includes(s.id));
      return first?.phone ?? '';
    }
    return '';
  }, [waRecipientType, claim, assignedInspectorId, assignedSupplierIds]);

  const recordWhatsAppContact = useCallback(
    async (input?: {
      status?: 'opened' | 'sent' | 'ready';
      recipientType?: 'insured' | 'adjuster' | 'vendor';
      recipientName?: string | null;
      phone?: string;
      message?: string;
      templateType?: string;
      purpose?: 'inspection' | 'repair';
    }): Promise<SaveStepResult> => {
      if (mode === 'preview' || !claimId) {
        return { ok: true, message: 'Önizleme — WhatsApp kaydı yazılmaz.' };
      }
      if (!canEdit) {
        return { ok: false, message: 'Bu işlem için yetkiniz yok.' };
      }
      const recipientMap: Record<string, 'insured' | 'adjuster' | 'vendor'> = {
        Sigortalı: 'insured',
        Tespitçi: 'adjuster',
        Tedarikçi: 'vendor',
      };
      const recipientType =
        input?.recipientType
        ?? recipientMap[waRecipientType]
        ?? 'insured';
      const recipientName =
        input?.recipientName
        ?? (waRecipientType === 'Sigortalı'
          ? claim.insuredName
          : waRecipientType === 'Tespitçi'
            ? claim.inspectors.find((i) => i.id === assignedInspectorId)?.name
            : claim.suppliers.find((s) => assignedSupplierIds.includes(s.id))?.name);
      try {
        await axios.post(
          `${API}/claim-operation-center/${claimId}/contact-events`,
          {
            channel: 'whatsapp',
            recipientType,
            recipientName,
            phone: input?.phone ?? resolveWaPhone(),
            templateType: input?.templateType ?? waTemplateType,
            message: input?.message ?? waBody,
            status: input?.status ?? 'opened',
            result: input?.status === 'sent' ? 'WhatsApp gönderildi' : 'WhatsApp açıldı',
            purpose: input?.purpose,
          },
          { headers: authHeader() },
        );
        await refreshClaim();
        return { ok: true, message: 'WhatsApp kaydı yazıldı.' };
      } catch (err) {
        reportCaughtError(err, 'WhatsApp kaydı yazılamadı; sohbet yine de açılıyor.', {
          toastType: 'warning',
        });
        return { ok: false, message: 'WhatsApp kaydı yazılamadı.' };
      }
    },
    [
      mode,
      claimId,
      canEdit,
      waRecipientType,
      waTemplateType,
      waBody,
      claim,
      assignedInspectorId,
      assignedSupplierIds,
      resolveWaPhone,
      refreshClaim,
    ],
  );

  const setApprovalAuthority = useCallback(
    (v: string) => {
      setApprovalAuthorityState(v);
      const party = resolvePlannerApprovalParty(v, {
        expertOfficeName: claim.expertOfficeName,
        expertOfficeEmail: claim.expertOfficeEmail,
        insurerName: claim.insurer,
        insurerEmail: claim.insurerEmail,
      });
      setEmailTo(party.email);
    },
    [claim.expertOfficeName, claim.expertOfficeEmail, claim.insurer, claim.insurerEmail],
  );

  const validateStep = useCallback(
    (step: StepId) => {
      if (step === 'report_writing' && isLegacyOpsCatchupBypassActive()) {
        return { ok: true, missing: [] as string[] };
      }
      const checks = getMandatoryChecks(step, claim, {
        meetingNote,
        apptNote,
        inspectorNote,
        insuredApproved,
        assignedInspectorId,
        assignedSupplierIds,
        supplierTasks,
        waRecipientType,
        waPhone: resolveWaPhone(),
        waBody,
        waTemplateType,
        digitalFormType,
        approvalAuthority,
        emailTo,
        emailSubject,
        approverType,
        approverName,
        meridyenNote,
      });
      const missing = missingMandatoryLabels(checks);
      return { ok: missing.length === 0, missing };
    },
    [
      claim,
      meetingNote,
      apptNote,
      inspectorNote,
      insuredApproved,
      assignedInspectorId,
      assignedSupplierIds,
      supplierTasks,
      waRecipientType,
      resolveWaPhone,
      waBody,
      waTemplateType,
      digitalFormType,
      approvalAuthority,
      emailTo,
      emailSubject,
      approverType,
      approverName,
      meridyenNote,
    ],
  );

  const saveStep = useCallback(
    async (step: StepId): Promise<SaveStepResult> => {
      const result = validateStep(step);
      if (!result.ok) {
        return {
          ok: false,
          message: `Zorunlu alanlar eksik: ${result.missing.join(', ')}. Kaydet yapılamaz.`,
          missing: result.missing,
        };
      }

      if (mode === 'preview' || !claimId) {
        return {
          ok: false,
          message:
            'Lokal önizleme: Kaydet API bağlı değil. Sahte başarı yok. Operasyon geçmişi production bağında yazılacak.',
        };
      }

      if (!canEdit) {
        return { ok: false, message: 'Bu işlem için yetkiniz yok.' };
      }

      if (saveLock.current) {
        return { ok: false, message: 'Kayıt sürüyor — tekrar gönderim engellendi.' };
      }

      saveLock.current = true;
      setSaving(true);
      try {
        switch (step) {
          case 'insured_appointment': {
            const isoDate = normalizeTrDateValue(claim.appointmentDate);
            const timePart = (claim.appointmentTime || '00:00').slice(0, 5);
            if (!isoDate || !/^\d{2}:\d{2}$/.test(timePart)) {
              return { ok: false, message: 'Randevu tarih/saat geçersiz.' };
            }
            const scheduledAt = new Date(`${isoDate}T${timePart}:00`);
            if (Number.isNaN(scheduledAt.getTime())) {
              return { ok: false, message: 'Randevu tarih/saat geçersiz.' };
            }
            await axios.put(
              `${API}/claim-operation-center/${claimId}/main-appointment`,
              {
                scheduledAt: scheduledAt.toISOString(),
                location: claim.address,
                locationUrl: claim.locationUrl || null,
                estimatedDurationMinutes: claim.durationMinutes
                  ? Number(claim.durationMinutes)
                  : null,
                notes: apptNote.trim() || null,
              },
              { headers: authHeader() },
            );
            await refreshClaim();
            return { ok: true, message: 'Ana randevu kaydedildi.' };
          }
          case 'inspector': {
            if (!assignedInspectorId) {
              return { ok: false, message: 'Tespitçi seçiniz.' };
            }
            const selected = claim.inspectors.find((i) => i.id === assignedInspectorId);
            if (selected?.source === 'meridyen') {
              await axios.post(
                `${API}/claim-files/${claimId}/assign`,
                { assignedFieldUserId: assignedInspectorId },
                { headers: authHeader() },
              );
            } else {
              await axios.post(
                `${API}/claim-files/${claimId}/assign-inspector-vendor`,
                { vendorId: assignedInspectorId, note: inspectorNote || undefined },
                { headers: authHeader() },
              );
            }
            await refreshClaim();
            return { ok: true, message: 'Tespitçi ataması kaydedildi.' };
          }
          case 'supplier': {
            const supplierNotes: Record<string, string> = {};
            const ids = assignedSupplierIds.filter((id) => id !== assignedInspectorId);
            if (assignedInspectorId && assignedSupplierIds.includes(assignedInspectorId) && ids.length === 0) {
              return {
                ok: false,
                message: 'Tespitçi olan tedarikçi olamaz. Bu kişi dosyada tespitçi olarak atanmış.',
              };
            }
            for (const id of ids) {
              const t = (supplierTasks[id] || '').trim();
              if (t) supplierNotes[id] = t;
            }
            await axios.post(
              `${API}/claim-files/${claimId}/assign-supplier`,
              {
                supplierIds: ids,
                supplierNotes,
                note: Object.values(supplierNotes).join(' | ') || undefined,
              },
              { headers: authHeader() },
            );
            await refreshClaim();
            if (assignedInspectorId && assignedSupplierIds.includes(assignedInspectorId)) {
              return {
                ok: true,
                message: 'Tedarikçi ataması kaydedildi. Tespitçi olan tedarikçi olamaz; tespitçi ayrı tutuldu.',
              };
            }
            return { ok: true, message: 'Tedarikçi ataması kaydedildi.' };
          }
          case 'whatsapp': {
            const recipientMap: Record<string, 'insured' | 'adjuster' | 'vendor'> = {
              Sigortalı: 'insured',
              Tespitçi: 'adjuster',
              Tedarikçi: 'vendor',
            };
            const recipientType = recipientMap[waRecipientType] ?? 'insured';
            await axios.post(
              `${API}/claim-operation-center/${claimId}/contact-events`,
              {
                channel: 'whatsapp',
                recipientType,
                recipientName:
                  waRecipientType === 'Sigortalı'
                    ? claim.insuredName
                    : waRecipientType === 'Tespitçi'
                      ? claim.inspectors.find((i) => i.id === assignedInspectorId)?.name
                      : claim.suppliers.find((s) => assignedSupplierIds.includes(s.id))?.name,
                phone: resolveWaPhone(),
                templateType: waTemplateType,
                message: waBody,
                status: 'ready',
              },
              { headers: authHeader() },
            );
            await refreshClaim();
            return {
              ok: true,
              message: 'WhatsApp kaydı yazıldı. Adım yeşile döner.',
            };
          }
          case 'digital_approval': {
            await refreshClaim();
            return {
              ok: true,
              message: 'Dijital onay sigortalının belgeden onayından gelir. Bu ekrandan onay yazılmaz.',
            };
          }
          case 'report_writing':
            return {
              ok: false,
              message:
                'Rapor yazım sayfasına buradan müdahale edilmez. Rapora Git ile Raporlar sekmesine gidin.',
            };
          case 'sent_for_approval':
            return {
              ok: false,
              message:
                'Onaya gönderme bu ekrandan tetiklenmez (rapor yazım sayfasına dokunulmaz). Raporlar sekmesindeki mevcut akışı kullanın.',
            };
          case 'approved':
            return {
              ok: false,
              message:
                'Onay kaydı bu ekrandan yazılmaz. Rapor onay akışı mevcut Raporlar sekmesindedir.',
            };
          case 'repair_whatsapp': {
            await refreshClaim();
            return {
              ok: true,
              message: 'Onarım planı bu sayfadaki WhatsApp gönderiminden kayda alınır. Gönderilen alıcı yeniden seçilmez.',
            };
          }
          case 'muvafakat':
            if (!claim.flowFlags.muvafakatApproved) {
              return { ok: false, message: 'Sigortalı muvafakatnameyi dijital onaylamadan bu adım bitmez.' };
            }
            await refreshClaim();
            return { ok: true, message: 'Muvafakatname dijital onayı alındı.' };
          case 'repair_complete': {
            await axios.post(
              `${API}/claim-operation-center/${claimId}/complete-repair`,
              {},
              { headers: authHeader() },
            );
            await refreshClaim();
            return { ok: true, message: 'Onarım bitti. Yönetici ve finansa mail gitti. Fatura için dosya kapanmaz.' };
          }
          case 'closure_survey': {
            await axios.post(
              `${API}/claim-operation-center/${claimId}/contact-events`,
              {
                channel: 'whatsapp',
                recipientType: 'insured',
                recipientName: claim.insuredName,
                phone: claim.insuredPhone,
                templateType: 'whatsapp_hasar_kapanis_anket',
                message: waBody || 'Kapanış anketi',
                status: 'ready',
              },
              { headers: authHeader() },
            );
            await refreshClaim();
            return { ok: true, message: 'Kapanış anketi WhatsApp kaydı yazıldı.' };
          }
          case 'docs_upload':
            await refreshClaim();
            return { ok: true, message: 'Evraklar → Tespit Ve Onarım’da birikir.' };
          default:
            return { ok: false, message: 'Bu adım için kayıt tanımlı değil.' };
        }
      } catch (error: any) {
        const msg =
          error?.response?.data?.message ??
          (Array.isArray(error?.response?.data?.message)
            ? error.response.data.message.join(', ')
            : null) ??
          'Kayıt başarısız.';
        return { ok: false, message: typeof msg === 'string' ? msg : 'Kayıt başarısız.' };
      } finally {
        saveLock.current = false;
        setSaving(false);
      }
    },
    [
      validateStep,
      mode,
      claimId,
      canEdit,
      claim,
      meetingNote,
      apptNote,
      inspectorNote,
      assignedInspectorId,
      assignedSupplierIds,
      supplierTasks,
      waRecipientType,
      waTemplateType,
      waBody,
      digitalFormType,
      resolveWaPhone,
      refreshClaim,
    ],
  );

  const value: PlannerDraft = {
    mode,
    canEdit,
    claim,
    setClaim,
    refreshClaim,
    meetingNote,
    setMeetingNote,
    apptNote,
    setApptNote,
    inspectorNote,
    setInspectorNote,
    insuredApproved,
    setInsuredApproved,
    assignedInspectorId,
    setAssignedInspectorId,
    assignedSupplierIds,
    setAssignedSupplierIds,
    supplierTasks,
    setSupplierTasks,
    waRecipientType,
    setWaRecipientType,
    waTemplateType,
    setWaTemplateType,
    waBody,
    setWaBody,
    digitalFormType,
    setDigitalFormType,
    approvalAuthority,
    setApprovalAuthority,
    emailTo,
    setEmailTo,
    emailSubject,
    setEmailSubject,
    approverType,
    setApproverType,
    approverName,
    setApproverName,
    meridyenNote,
    setMeridyenNote,
    templates,
    templatesFromSettings,
    templatesLoading,
    buildInsuredApptMessage,
    buildInspectorMessage,
    buildVendorTaskMessage,
    applyWaTemplateForRecipient,
    validateStep,
    saveStep,
    recordWhatsAppContact,
    saving,
    onGoToReports: onGoToReports ?? null,
  };

  return <PlannerCtx.Provider value={value}>{children}</PlannerCtx.Provider>;
}

export function usePlanner() {
  const ctx = useContext(PlannerCtx);
  if (!ctx) throw new Error('usePlanner PlannerProvider içinde kullanılmalı');
  return ctx;
}
