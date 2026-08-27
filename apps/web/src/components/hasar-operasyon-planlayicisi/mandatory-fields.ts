/**
 * Operasyon Planlayıcısı — Kaydet zorunlu alan listesi
 */

import type { StepId } from './types';
import type { PlannerClaimSnapshot } from './claim-snapshot';

export type MandatoryCheck = {
  key: string;
  label: string;
  ok: boolean;
};

export function getMandatoryChecks(
  step: StepId,
  claim: PlannerClaimSnapshot,
  ctx: {
    meetingNote: string;
    apptNote: string;
    inspectorNote: string;
    insuredApproved: boolean;
    assignedInspectorId: string | null;
    assignedSupplierIds: string[];
    supplierTasks: Record<string, string>;
    waRecipientType: string;
    waPhone: string;
    waBody: string;
    waTemplateType: string;
    digitalFormType: string;
    approvalAuthority: string;
    emailTo: string;
    emailSubject: string;
    approverType: string;
    approverName: string;
    meridyenNote: string;
  },
): MandatoryCheck[] {
  switch (step) {
    case 'insured_appointment':
      return [
        { key: 'insured_name', label: 'Sigortalı Adı Soyadı', ok: Boolean(claim.insuredName.trim()) && claim.insuredName !== '—' },
        { key: 'insured_phone', label: 'Telefon', ok: Boolean(claim.insuredPhone.trim()) },
        { key: 'address', label: 'Adres', ok: Boolean(claim.address.trim()) && claim.address !== '—' },
        { key: 'appt_date', label: 'Randevu Tarihi', ok: Boolean(claim.appointmentDate.trim()) },
        { key: 'appt_time', label: 'Randevu Saati', ok: Boolean(claim.appointmentTime.trim()) },
        { key: 'insured_wa', label: 'Sigortalı WhatsApp gönderimi', ok: claim.contactWa.insured },
      ];
    case 'inspector':
      return [
        { key: 'appt_date', label: 'Ana Randevu Tarihi', ok: Boolean(claim.appointmentDate.trim()) },
        { key: 'appt_time', label: 'Ana Randevu Saati', ok: Boolean(claim.appointmentTime.trim()) },
        { key: 'address', label: 'Adres', ok: Boolean(claim.address.trim()) && claim.address !== '—' },
        {
          key: 'inspector',
          label: 'Atanan Tespitçi',
          ok: Boolean(ctx.assignedInspectorId),
        },
        {
          key: 'inspector_note',
          label: 'Tespitçi notu',
          ok: ctx.inspectorNote.trim().length >= 3,
        },
        {
          key: 'inspector_wa',
          label: 'Tespitçi WhatsApp gönderimi',
          ok: claim.contactWa.inspector,
        },
      ];
    case 'supplier':
      return [
        {
          key: 'suppliers',
          label: 'En Az Bir Tedarikçi Ataması',
          ok: ctx.assignedSupplierIds.length > 0,
        },
        {
          key: 'tasks',
          label: 'Atanan her tedarikçi için görev notu',
          ok:
            ctx.assignedSupplierIds.length > 0 &&
            ctx.assignedSupplierIds.every((id) => (ctx.supplierTasks[id] ?? '').trim().length >= 3),
        },
        {
          key: 'supplier_wa',
          label: 'Tedarikçi WhatsApp gönderimi',
          ok: claim.contactWa.vendor,
        },
      ];
    case 'whatsapp':
      return [
        { key: 'recipient_type', label: 'Alıcı Türü', ok: Boolean(ctx.waRecipientType.trim()) },
        { key: 'phone', label: 'Telefon', ok: ctx.waPhone.replace(/\D/g, '').length >= 10 },
        { key: 'template', label: 'Şablon (Ayarlar › Mesaj Şablonları)', ok: Boolean(ctx.waTemplateType.trim()) },
        { key: 'body', label: 'Mesaj İçeriği', ok: ctx.waBody.trim().length >= 5 },
      ];
    case 'repair_whatsapp':
      return [
        { key: 'suppliers', label: 'Tedarikçi ataması', ok: ctx.assignedSupplierIds.length > 0 },
        { key: 'approved', label: 'Müşteri raporu onayı', ok: claim.stepStatuses.approved === 'done' },
      ];
    case 'muvafakat':
      return [
        { key: 'muvafakat', label: 'Muvafakatname dijital onayı', ok: claim.flowFlags.muvafakatApproved },
      ];
    case 'closure_survey':
      return [{ key: 'phone', label: 'Sigortalı telefon', ok: Boolean(claim.insuredPhone.trim()) }];
    case 'digital_approval':
      return [
        {
          key: 'muvafakat',
          label: 'Dijital onay (mutabakat / muvafakat)',
          ok: claim.flowFlags.muvafakatApproved,
        },
      ];
    case 'report_writing': {
      const r = claim.report.readyChecks;
      return [
        { key: 'report_complete', label: 'Rapor Tamam', ok: r.reportComplete },
        { key: 'docs', label: 'Zorunlu Evraklar', ok: r.docsComplete },
        { key: 'photos', label: 'Fotoğraflar', ok: r.photosComplete },
        { key: 'finance', label: 'Finansal Özet', ok: r.financeReady },
        { key: 'revision', label: 'Revizyon Durumu Uygun', ok: r.revisionOk },
      ];
    }
    case 'sent_for_approval':
      return [
        { key: 'authority', label: 'Onay Mercii', ok: Boolean(ctx.approvalAuthority.trim()) },
        { key: 'email', label: 'E-posta Adresi', ok: ctx.emailTo.includes('@') },
        { key: 'subject', label: 'E-posta Konusu', ok: ctx.emailSubject.trim().length >= 3 },
      ];
    case 'approved': {
      return [
        { key: 'report_ready', label: 'Rapor hazır', ok: claim.report.readyChecks.reportComplete },
        {
          key: 'file_approved',
          label: 'Dosya raporu onaylı',
          ok: claim.stepStatuses.approved === 'done',
        },
      ];
    }
    case 'repair_complete':
      return [
        { key: 'muvafakat', label: 'Dijital onay', ok: claim.flowFlags.muvafakatApproved },
        { key: 'photos', label: 'Her tedarikçi onarım resmi', ok: claim.flowFlags.repairPhotosReady },
      ];
    case 'docs_upload':
      return [{ key: 'claim', label: 'Dosya', ok: Boolean(claim.claimId) }];
    default:
      return [];
  }
}

export function missingMandatoryLabels(checks: MandatoryCheck[]): string[] {
  return checks.filter((c) => !c.ok).map((c) => c.label);
}
