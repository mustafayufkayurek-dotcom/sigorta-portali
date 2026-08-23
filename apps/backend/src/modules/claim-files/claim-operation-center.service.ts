import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import {
  MessageTemplateService,
  TEMPLATE_TYPES,
} from '@/modules/notifications/sms/message-template.service';
import { buildWhatsAppMeUrl } from '@/common/utils/whatsapp-phone';
import { ClaimEventEmailService } from '@/modules/notifications/email/claim-event-email.service';
import { RepairReportsService } from '@/modules/repair-reports/repair-reports.service';
import {
  resolveApproval72hCustomerEmailPayload,
  resolveCustomerReminderEmail,
  resolveCustomerReminderTitle,
} from './approval-72h-customer-email.rule';
import { vendorsMissingRepairPhotos } from '@sigorta/shared';

const MANUAL_DECISION_MIN_REASON = 10;
const PORTAL_ROLE_CODES = new Set([
  'expert',
  'insurance_company_user',
  'assistance_company_user',
  'EXPERT',
  'INSURANCE_COMPANY_USER',
  'ASSISTANCE_COMPANY_USER',
]);
const MERIDYEN_ROLE_CODES = new Set([
  'admin',
  'ADMIN',
  'manager',
  'MANAGER',
  'ops_manager',
  'OPS_MANAGER',
  'office_staff',
  'OFFICE_STAFF',
  'field_staff',
  'FIELD_STAFF',
]);

type Actor = {
  id?: string;
  userId?: string;
  roleCode?: string;
  role?: { code?: string };
};

type MainAppointmentInput = {
  scheduledAt: string;
  location: string;
  locationUrl?: string | null;
  estimatedDurationMinutes?: number | null;
  notes?: string | null;
};

type ContactEventInput = {
  channel: 'phone' | 'whatsapp';
  recipientType: 'insured' | 'adjuster' | 'vendor';
  recipientId?: string | null;
  recipientName?: string | null;
  phone?: string | null;
  templateType?: string | null;
  message?: string | null;
  status:
    | 'called'
    | 'ready'
    | 'opened'
    | 'sent'
    | 'failed';
  result?: string | null;
  retryOfId?: string | null;
  purpose?: 'inspection' | 'repair';
};

type AppointmentRecipient = 'insured' | 'adjuster' | 'vendors';
type AppointmentNotifyPurpose = 'inspection' | 'repair';

@Injectable()
export class ClaimOperationCenterService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly templateService: MessageTemplateService,
    private readonly claimEventEmail: ClaimEventEmailService,
    private readonly repairReports: RepairReportsService,
  ) {}

  private assertMeridyenStaff(actor: Actor) {
    const role = this.actorRole(actor);
    if (PORTAL_ROLE_CODES.has(role) || !MERIDYEN_ROLE_CODES.has(role)) {
      throw new ForbiddenException('Manuel karar yalnız Meridyen personeli tarafından kaydedilebilir.');
    }
  }

  private actorId(actor: Actor): string {
    const id = actor?.id ?? actor?.userId;
    if (!id) throw new BadRequestException('İşlemi yapan kullanıcı bulunamadı.');
    return id;
  }

  private actorRole(actor: Actor): string {
    return actor?.roleCode ?? actor?.role?.code ?? 'unknown';
  }

  private waUrl(phone: string | null | undefined, message: string): string | null {
    return buildWhatsAppMeUrl(phone, message);
  }

  private async log(
    claimFileId: string,
    actor: Actor,
    action: string,
    description: string,
    metadata: Record<string, unknown>,
  ) {
    return this.prisma.fileActivityLog.create({
      data: {
        claimFileId,
        actorId: this.actorId(actor),
        actorRole: this.actorRole(actor),
        action: action as any,
        description,
        metadata: metadata as any,
      },
    });
  }

  private async getClaimOrThrow(id: string) {
    const claim = await this.prisma.claimFile.findUnique({
      where: { id },
      include: {
        customer: { include: { contacts: true } },
        insuranceCompany: true,
        propertyAddress: true,
        claimSubject: true,
        assignedInspectorVendor: true,
        supplierAssignments: {
          orderBy: { sortOrder: 'asc' },
          include: {
            vendor: {
              include: {
                vendorWorkGroups: { include: { workGroup: true } },
                serviceAreas: {
                  include: { province: true, district: true },
                },
              },
            },
          },
        },
      },
    });
    if (!claim) throw new NotFoundException('Dosya bulunamadı.');
    return claim;
  }

  async getByFileNo(fileNo: string) {
    const claim = await this.prisma.claimFile.findUnique({
      where: { fileNo },
      select: { id: true },
    });
    if (!claim) throw new NotFoundException('Dosya bulunamadı.');
    return this.getByClaimId(claim.id);
  }

  async getByClaimId(claimFileId: string) {
    const claim = await this.getClaimOrThrow(claimFileId);
    const [appointment, activity] = await Promise.all([
      this.prisma.appointment.findFirst({
        where: { claimFileId, isPrimaryInspection: true },
        include: {
          adjuster: true,
          assignedUser: {
            select: { id: true, firstName: true, lastName: true, phone: true },
          },
          vendor: true,
        },
      }),
      this.prisma.fileActivityLog.findMany({
        where: { claimFileId },
        include: {
          actor: {
            select: { id: true, firstName: true, lastName: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: 100,
      }),
    ]);

    const insuredName =
      claim.insuredName ??
      claim.customer?.fullName ??
      claim.customer?.companyName ??
      null;
    const insuredPhone = claim.insuredPhone ?? claim.customer?.phone ?? null;
    const address = claim.propertyAddress
      ? [
          claim.propertyAddress.addressLine,
          claim.propertyAddress.district,
          claim.propertyAddress.city,
        ]
          .filter(Boolean)
          .join(', ')
      : null;

    const latestAppointmentChange = activity.find(
      (item) =>
        item.action === ('APPOINTMENT_UPDATED' as any) ||
        item.action === ('APPOINTMENT_SCHEDULED' as any),
    );
    const currentNotificationActivity = activity.filter(
      (item) =>
        item.action === ('APPOINTMENT_NOTIFICATION_RECORDED' as any) &&
        (!latestAppointmentChange || item.createdAt >= latestAppointmentChange.createdAt),
    );
    const resultByPreparedEventId = new Map<string, Record<string, unknown>>();
    for (const item of currentNotificationActivity) {
      const metadata = (item.metadata ?? {}) as Record<string, unknown>;
      const preparedEventId =
        typeof metadata.preparedEventId === 'string' ? metadata.preparedEventId : null;
      if (preparedEventId && !resultByPreparedEventId.has(preparedEventId)) {
        resultByPreparedEventId.set(preparedEventId, metadata);
      }
    }
    const latestPreparationByRecipient = new Map<
      string,
      (typeof currentNotificationActivity)[number]
    >();
    for (const item of currentNotificationActivity) {
      const metadata = (item.metadata ?? {}) as Record<string, unknown>;
      if (
        typeof metadata.templateType !== 'string' ||
        typeof metadata.recipientType !== 'string' ||
        metadata.preparedEventId
      ) {
        continue;
      }
      const key = `${metadata.recipientType}:${metadata.recipientId ?? 'insured'}`;
      if (!latestPreparationByRecipient.has(key)) {
        latestPreparationByRecipient.set(key, item);
      }
    }
    const recipientOrder = [
      'insured',
      `adjuster:${claim.assignedInspectorVendorId ?? ''}`,
      ...claim.supplierAssignments.map((item) => `vendor:${item.vendorId}`),
    ];
    const appointmentNotifications = Array.from(latestPreparationByRecipient.values())
      .map((item) => {
        const metadata = (item.metadata ?? {}) as Record<string, unknown>;
        const result = resultByPreparedEventId.get(item.id);
        return {
          eventId: item.id,
          recipientType: metadata.recipientType,
          recipientId: metadata.recipientId ?? null,
          recipientName: metadata.recipientName,
          phone: metadata.phone ?? null,
          message: metadata.message,
          templateType: metadata.templateType,
          status: result?.status ?? metadata.status,
          url: metadata.url ?? null,
        };
      })
      .sort((left, right) => {
        const leftKey =
          left.recipientType === 'insured'
            ? 'insured'
            : `${left.recipientType}:${left.recipientId ?? ''}`;
        const rightKey =
          right.recipientType === 'insured'
            ? 'insured'
            : `${right.recipientType}:${right.recipientId ?? ''}`;
        return recipientOrder.indexOf(leftKey) - recipientOrder.indexOf(rightKey);
      });

    return {
      claim: {
        id: claim.id,
        fileNo: claim.fileNo,
        insuredName,
        insuredPhone,
        lossType: claim.lossType,
        serviceGroup: claim.claimSubject?.name ?? claim.lossType,
        address,
        city: claim.propertyAddress?.city ?? claim.customer?.city ?? null,
        district: claim.propertyAddress?.district ?? claim.customer?.district ?? null,
        locationUrl:
          claim.propertyAddress?.latitude != null && claim.propertyAddress?.longitude != null
            ? `https://www.google.com/maps/search/?api=1&query=${claim.propertyAddress.latitude},${claim.propertyAddress.longitude}`
            : null,
      },
      mainAppointment: appointment,
      assignedInspector: claim.assignedInspectorVendor,
      assignedSuppliers: claim.supplierAssignments.map((link) => ({
        ...link.vendor,
        workGroups: link.vendor.vendorWorkGroups.map((item) => item.workGroup),
        serviceAreas: link.vendor.serviceAreas,
        assignedAt: link.assignedAt,
        /** Görev tanımı / talimat — planlayıcı hydrate için zorunlu */
        note: link.note ?? null,
      })),
      activity,
      appointmentNotifications,
      flowFlags: await this.buildFlowFlags(
        claimFileId,
        claim.supplierAssignments.map((s) => s.vendorId),
      ),
    };
  }

  private async buildFlowFlags(claimFileId: string, vendorIds: string[]) {
    const [docs, fileDoc, claimRow, report] = await Promise.all([
      this.prisma.entityDocument.findMany({
        where: { entityType: 'claim_file', entityId: claimFileId },
        select: { notes: true, mimeType: true },
      }),
      this.prisma.fileDocument.findFirst({
        where: { entityType: 'claim_file', entityId: claimFileId, documentKind: 'muvafakatname' },
        orderBy: { createdAt: 'desc' },
        select: { digitallyApprovedAt: true, status: true },
      }),
      this.prisma.claimFile.findUnique({
        where: { id: claimFileId },
        select: { currentStatus: { select: { code: true } } },
      }),
      this.prisma.repairReport.findFirst({
        where: { claimFileId, status: { in: ['approved', 'externally_approved'] } },
        select: { id: true },
      }),
    ]);
    const photoDocs = docs.filter((d) => String(d.mimeType ?? '').startsWith('image/'));
    const missingPhotoVendorIds = vendorsMissingRepairPhotos(vendorIds, photoDocs);
    const muvafakatApproved = Boolean(fileDoc?.digitallyApprovedAt);
    const code = claimRow?.currentStatus?.code ?? '';
    const repairCompleted = [
      'repair_completed',
      'invoice_pending',
      'invoice_submitted',
      'payment_pending',
      'partially_collected',
      'closed',
    ].includes(code);
    return {
      muvafakatApproved,
      muvafakatStatus: fileDoc?.status ?? null,
      missingPhotoVendorIds,
      repairPhotosReady: vendorIds.length > 0 && missingPhotoVendorIds.length === 0,
      repairCompleted,
      canInvoice: muvafakatApproved && Boolean(report),
    };
  }

  async upsertMainAppointment(
    claimFileId: string,
    input: MainAppointmentInput,
    actor: Actor,
  ) {
    const claim = await this.getClaimOrThrow(claimFileId);
    const scheduledAt = new Date(input.scheduledAt);
    if (Number.isNaN(scheduledAt.getTime())) {
      throw new BadRequestException('Geçerli randevu tarih ve saati zorunludur.');
    }
    if (!input.location?.trim()) {
      throw new BadRequestException('Randevu adresi zorunludur.');
    }
    if (
      input.estimatedDurationMinutes != null &&
      (!Number.isInteger(input.estimatedDurationMinutes) ||
        input.estimatedDurationMinutes < 1 ||
        input.estimatedDurationMinutes > 1440)
    ) {
      throw new BadRequestException('Tahmini süre 1-1440 dakika arasında olmalıdır.');
    }

    const current = await this.prisma.appointment.findFirst({
      where: { claimFileId, isPrimaryInspection: true },
    });
    const oldValue = current
      ? {
          scheduledAt: current.scheduledAt,
          location: current.location,
          locationUrl: current.locationUrl,
          estimatedDurationMinutes: current.estimatedDurationMinutes,
          notes: current.notes,
        }
      : null;

    const appointment = await this.prisma.$transaction(async (tx) => {
      if (current) {
        return tx.appointment.update({
          where: { id: current.id },
          data: {
            scheduledAt,
            location: input.location.trim(),
            locationUrl: input.locationUrl?.trim() || null,
            estimatedDurationMinutes: input.estimatedDurationMinutes ?? null,
            notes: input.notes?.trim() || null,
          },
          include: { adjuster: true, assignedUser: true, vendor: true },
        });
      }
      return tx.appointment.create({
        data: {
          claimFileId,
          type: 'inspection',
          scheduledAt,
          location: input.location.trim(),
          locationUrl: input.locationUrl?.trim() || null,
          estimatedDurationMinutes: input.estimatedDurationMinutes ?? null,
          notes: input.notes?.trim() || null,
          status: 'planned',
          isPrimaryInspection: true,
        },
        include: { adjuster: true, assignedUser: true, vendor: true },
      });
    });

    const newValue = {
      scheduledAt: appointment.scheduledAt,
      location: appointment.location,
      locationUrl: appointment.locationUrl,
      estimatedDurationMinutes: appointment.estimatedDurationMinutes,
      notes: appointment.notes,
    };
    const history = await this.log(
      claimFileId,
      actor,
      current ? 'APPOINTMENT_UPDATED' : 'APPOINTMENT_SCHEDULED',
      current ? 'Ana tespit randevusu güncellendi.' : 'Ana tespit randevusu oluşturuldu.',
      {
        appointmentId: appointment.id,
        oldValue,
        newValue,
        inheritedBy: {
          adjuster: Boolean(claim.assignedInspectorVendorId),
          supplierIds: claim.supplierAssignments.map((item) => item.vendorId),
        },
      },
    );
    void this.notifyInspectionPlanEmail(claim, appointment.scheduledAt, appointment.location, actor).catch(
      () => undefined,
    );
    return { appointment, history };
  }

  private async notifyInspectionPlanEmail(
    claim: Awaited<ReturnType<ClaimOperationCenterService['getClaimOrThrow']>>,
    scheduledAt: Date,
    location: string | null,
    actor: Actor,
  ) {
    const resolved = resolveApproval72hCustomerEmailPayload({
      fileNo: claim.fileNo,
      insuredName: claim.insuredName,
      customer: claim.customer,
      insuranceCompany: claim.insuranceCompany,
      propertyAddress: claim.propertyAddress,
    });
    const scheduledLabel = `${scheduledAt.toLocaleDateString('tr-TR')} ${scheduledAt.toLocaleTimeString('tr-TR', {
      hour: '2-digit',
      minute: '2-digit',
    })}`;
    if (!resolved.ok) {
      await this.log(
        claim.id,
        actor,
        'NOTE_ADDED',
        `Tespit planı müşteri maili gönderilmedi: ${resolved.reason}`,
        { kind: 'inspection_plan_email', status: 'skipped', reason: resolved.reason },
      );
      return;
    }
    const sent = await this.claimEventEmail.onInspectionPlanned({
      recipientEmail: resolved.payload.recipientEmail,
      recipientName: resolved.payload.recipientName,
      fileNo: resolved.payload.fileNo,
      customerName: resolved.payload.customerName,
      insuredName: resolved.payload.insuredName,
      scheduledLabel,
      location: location?.trim() || '—',
      claimFileId: claim.id,
    });
    await this.log(
      claim.id,
      actor,
      'NOTE_ADDED',
      sent.sent
        ? `Tespit planı müşteriye mail gitti (${resolved.payload.recipientEmail}).`
        : `Tespit planı müşteri maili gönderilemedi.`,
      {
        kind: 'inspection_plan_email',
        status: sent.sent ? 'sent' : 'failed',
        to: resolved.payload.recipientEmail,
        purpose: 'tespit_planlama',
        errorMsg: 'errorMsg' in sent ? sent.errorMsg : null,
      },
    );
  }

  async recordContactEvent(
    claimFileId: string,
    input: ContactEventInput,
    actor: Actor,
  ) {
    await this.getClaimOrThrow(claimFileId);
    const action =
      input.channel === 'phone' ? 'PHONE_CALL_RECORDED' : 'WHATSAPP_STATUS_RECORDED';
    const occurredAt = new Date().toISOString();
    const phoneLabel = (input.phone ?? '').trim() || '—';
    const nameLabel = (input.recipientName ?? '').trim();
    const msg = (input.message ?? '').trim();
    const msgPreview = msg.length > 160 ? `${msg.slice(0, 157)}…` : msg;

    // Çift tık / mobil touch+click → aynı kaydı 90 sn içinde tekrarlama
    const dedupeSince = new Date(Date.now() - 90_000);
    const recent = await this.prisma.fileActivityLog.findMany({
      where: {
        claimFileId,
        action,
        actorId: this.actorId(actor),
        createdAt: { gte: dedupeSince },
      },
      orderBy: { createdAt: 'desc' },
      take: 8,
    });
    const phoneNorm = phoneLabel.replace(/\D/g, '');
    const dup = recent.find((row) => {
      const meta = (row.metadata ?? {}) as Record<string, unknown>;
      const metaPhone = String(meta.phone ?? '').replace(/\D/g, '');
      const metaMsg = String(meta.message ?? '').trim();
      const samePhone = !phoneNorm || !metaPhone || metaPhone === phoneNorm;
      const sameMsg = !msg || !metaMsg || metaMsg === msg;
      return samePhone && sameMsg;
    });
    if (dup) return dup;

    const description =
      input.channel === 'phone'
        ? [
            'Telefon araması kaydedildi',
            nameLabel || null,
            phoneLabel !== '—' ? phoneLabel : null,
          ]
            .filter(Boolean)
            .join(' · ')
        : [
            'WhatsApp mesajı kaydedildi',
            nameLabel || null,
            phoneLabel !== '—' ? phoneLabel : null,
            msgPreview || null,
          ]
            .filter(Boolean)
            .join(' · ');
    return this.log(claimFileId, actor, action, description, {
      ...input,
      occurredAt,
      message: msg || input.message || null,
    });
  }

  async prepareAppointmentNotifications(
    claimFileId: string,
    recipients: AppointmentRecipient[],
    actor: Actor,
    purpose: AppointmentNotifyPurpose = 'inspection',
  ) {
    const claim = await this.getClaimOrThrow(claimFileId);
    const appointment = await this.prisma.appointment.findFirst({
      where: { claimFileId, isPrimaryInspection: true },
    });
    if (!appointment) throw new BadRequestException('Ana tespit randevusu bulunamadı.');

    const date = appointment.scheduledAt.toLocaleDateString('tr-TR');
    const time = appointment.scheduledAt.toLocaleTimeString('tr-TR', {
      hour: '2-digit',
      minute: '2-digit',
    });
    const insuredName =
      claim.insuredName ??
      claim.customer?.fullName ??
      claim.customer?.companyName ??
      'Sigortalı';
    const address = appointment.location ?? 'Adres belirtilmedi';
    const duration = appointment.estimatedDurationMinutes
      ? `${appointment.estimatedDurationMinutes} Dakika`
      : 'Belirtilmedi';
    const vars = {
      musteriAdi: insuredName,
      musteriTelefon: claim.insuredPhone ?? claim.customer?.phone ?? '',
      dosyaNo: claim.fileNo,
      isTanimi: claim.claimSubject?.name ?? claim.lossType ?? 'Hasar Tespiti',
      hasarAdresi: address,
      randevuTarih: date,
      randevuSaat: time,
      tahminiSure: duration,
    };

    const targets: Array<{
      recipientType: 'insured' | 'adjuster' | 'vendor';
      recipientId: string | null;
      recipientName: string;
      phone: string | null;
      templateType: string;
    }> = [];
    if (recipients.includes('insured')) {
      targets.push({
        recipientType: 'insured',
        recipientId: claim.customerId,
        recipientName: insuredName,
        phone: claim.insuredPhone ?? claim.customer?.phone ?? null,
        templateType:
          purpose === 'repair'
            ? TEMPLATE_TYPES.WHATSAPP_HASAR_REPAIR_INSURED
            : TEMPLATE_TYPES.WHATSAPP_HASAR_APPOINTMENT_INSURED,
      });
    }
    if (purpose !== 'repair' && recipients.includes('adjuster') && claim.assignedInspectorVendor) {
      targets.push({
        recipientType: 'adjuster',
        recipientId: claim.assignedInspectorVendor.id,
        recipientName: claim.assignedInspectorVendor.name,
        phone:
          claim.assignedInspectorVendor.authorizedPhone ??
          claim.assignedInspectorVendor.phone ??
          null,
        templateType: TEMPLATE_TYPES.WHATSAPP_HASAR_APPOINTMENT_ADJUSTER,
      });
    }
    if (recipients.includes('vendors')) {
      for (const link of claim.supplierAssignments) {
        targets.push({
          recipientType: 'vendor',
          recipientId: link.vendor.id,
          recipientName: link.vendor.name,
          phone: link.vendor.authorizedPhone ?? link.vendor.phone ?? null,
          templateType:
            purpose === 'repair'
              ? TEMPLATE_TYPES.WHATSAPP_HASAR_REPAIR_VENDOR
              : TEMPLATE_TYPES.WHATSAPP_HASAR_APPOINTMENT_VENDOR,
        });
      }
    }

    const groupLabel = purpose === 'repair' ? 'onarım randevusu' : 'tespit randevusu';
    const results = [];
    for (const target of targets) {
      const template = await this.templateService.getByType(target.templateType);
      const message = this.templateService.interpolate(template.content, vars);
      const url = this.waUrl(target.phone, message);
      const status = url ? 'ready' : 'failed';
      const event = await this.log(
        claimFileId,
        actor,
        'APPOINTMENT_NOTIFICATION_RECORDED',
        `${target.recipientName} için ${groupLabel} ${url ? 'hazırlandı' : 'hazırlanamadı'}.`,
        {
          appointmentId: appointment.id,
          purpose,
          ...target,
          message,
          status,
          url,
        },
      );
      results.push({ eventId: event.id, ...target, message, status, url, purpose });
    }
    return results;
  }

  async recordAppointmentNotificationResult(
    claimFileId: string,
    input: {
      appointmentId: string;
      recipientType: 'insured' | 'adjuster' | 'vendor';
      recipientId?: string | null;
      recipientName: string;
      message?: string | null;
      status: 'opened' | 'sent' | 'failed' | 'pending';
      result?: string | null;
      preparedEventId?: string | null;
    },
    actor: Actor,
  ) {
    return this.log(
      claimFileId,
      actor,
      'APPOINTMENT_NOTIFICATION_RECORDED',
      `${input.recipientName} randevu bildirimi: ${input.status}.`,
      { ...input, recordedAt: new Date().toISOString() },
    );
  }

  /**
   * Dijital onay adımı — migration yok; mevcut NOTE_ADDED + metadata.kind ile kalıcı kayıt.
   */
  async recordDigitalApproval(
    claimFileId: string,
    input: {
      formType: string;
      status: 'sent' | 'approved';
      insuredName?: string | null;
      link?: string | null;
    },
    actor: Actor,
  ) {
    await this.getClaimOrThrow(claimFileId);
    const formType = (input.formType ?? '').trim();
    if (!formType) {
      throw new BadRequestException('Form türü zorunludur.');
    }
    if (input.status !== 'sent' && input.status !== 'approved') {
      throw new BadRequestException('Geçersiz dijital onay durumu.');
    }
    const description =
      input.status === 'approved'
        ? `Dijital onay tamamlandı (${formType}).`
        : `Dijital onay formu gönderildi (${formType}).`;
    return this.log(claimFileId, actor, 'NOTE_ADDED', description, {
      kind: 'digital_approval',
      formType,
      status: input.status,
      insuredName: input.insuredName ?? null,
      link: input.link ?? null,
      recordedAt: new Date().toISOString(),
    });
  }

  /**
   * Sözlü müşteri kararı — zorunlu açıklama + durum + yönetici/müşteri maili.
   * Migration yok; NOTE_ADDED + mevcut rapor onay API.
   */
  async recordManualDecision(
    claimFileId: string,
    input: { action: 'approve' | 'reject' | 'revise'; reason: string },
    actor: Actor,
  ) {
    this.assertMeridyenStaff(actor);
    const reason = (input.reason ?? '').trim();
    if (reason.length < MANUAL_DECISION_MIN_REASON) {
      throw new BadRequestException(`Açıklama en az ${MANUAL_DECISION_MIN_REASON} karakter olmalıdır.`);
    }
    if (!['approve', 'reject', 'revise'].includes(input.action)) {
      throw new BadRequestException('Geçersiz manuel karar işlemi.');
    }

    const claim = await this.prisma.claimFile.findUnique({
      where: { id: claimFileId },
      select: {
        id: true,
        fileNo: true,
        insuredName: true,
        customer: {
          select: {
            email: true,
            shortName: true,
            companyName: true,
            fullName: true,
            firstName: true,
            lastName: true,
            contactFirstName: true,
            contactLastName: true,
            contacts: { select: { email: true, isPrimary: true }, take: 10 },
          },
        },
      },
    });
    if (!claim) throw new NotFoundException('Dosya bulunamadı.');

    const actorId = this.actorId(actor);
    const actorUser = await this.prisma.user.findUnique({
      where: { id: actorId },
      select: { firstName: true, lastName: true },
    });
    const actorName = `${actorUser?.firstName ?? ''} ${actorUser?.lastName ?? ''}`.trim() || 'Meridyen Personeli';

    let statusApplied: string | null = null;
    let reportId: string | null = null;

    if (input.action === 'approve' || input.action === 'reject') {
      const pending = await this.prisma.repairReport.findFirst({
        where: { claimFileId, status: 'pending_approval' },
        orderBy: { updatedAt: 'desc' },
        select: { id: true },
      });
      if (pending) {
        reportId = pending.id;
        if (input.action === 'approve') {
          await this.repairReports.approveReport(
            pending.id,
            actorId,
            `Sözlü Müşteri Onayı — ${reason}`,
          );
          statusApplied = 'report_approved';
        } else {
          await this.repairReports.rejectReport(
            pending.id,
            actorId,
            `Sözlü Müşteri Reddi — ${reason}`,
          );
          statusApplied = 'report_rejected';
        }
      } else if (input.action === 'reject') {
        const rejectedIds = await this.repairReports.supersedeOpenWritingReports(
          claimFileId,
          actorId,
          `Sözlü Müşteri Reddi — ${reason}`,
        );
        if (rejectedIds.length) {
          reportId = rejectedIds[0];
          statusApplied = 'report_rejected';
        } else {
          statusApplied = 'file_rejected_note';
        }
      } else {
        statusApplied = 'file_approved_note';
      }
    } else {
      const sourceReport = await this.prisma.repairReport.findFirst({
        where: {
          claimFileId,
          status: {
            in: ['approved', 'externally_approved', 'externally_rejected', 'pending_approval'],
          },
        },
        orderBy: { updatedAt: 'desc' },
        select: { id: true, status: true },
      });
      if (sourceReport) {
        const revised = await this.repairReports.reviseReport(sourceReport.id, actorId, {
          reason: 'verbal_manual',
          reasonNote: `Sözlü Müşteri Revizyonu — ${reason}`,
          allowPendingVerbal: sourceReport.status === 'pending_approval',
        });
        reportId = revised?.id ?? sourceReport.id;
        statusApplied = 'report_revised';
      } else {
        statusApplied = 'revision_requested_note';
      }
    }

    const actionLabel =
      input.action === 'approve' ? 'Manuel Onay' : input.action === 'reject' ? 'Manuel Red' : 'Manuel Revizyon';
    const log = await this.log(
      claimFileId,
      actor,
      'NOTE_ADDED',
      `${actionLabel}: ${reason}`,
      {
        kind: 'manual_decision',
        action: input.action,
        reason,
        channel: 'verbal',
        statusApplied,
        reportId,
        recordedAt: new Date().toISOString(),
      },
    );

    const managers = await this.prisma.user.findMany({
      where: {
        status: 'active',
        role: { code: { in: ['admin', 'ADMIN', 'manager', 'MANAGER', 'ops_manager', 'OPS_MANAGER'] } },
      },
      select: { email: true },
      take: 40,
    });

    const customerEmail = resolveCustomerReminderEmail(claim.customer);
    const customerTitle = resolveCustomerReminderTitle(claim.customer);

    void this.claimEventEmail.onManualDecision({
      action: input.action,
      fileNo: claim.fileNo,
      reason,
      actorName,
      claimFileId: claim.id,
      customerEmail,
      managerEmails: managers.map((m) => m.email).filter(Boolean) as string[],
    });

    return {
      id: log.id,
      action: input.action,
      actionLabel,
      statusApplied,
      reportId,
      customerNotified: Boolean(customerEmail),
      customerTitle,
      reason,
    };
  }

  async completeRepair(claimFileId: string, actor: Actor) {
    const claim = await this.getClaimOrThrow(claimFileId);
    const flags = await this.buildFlowFlags(
      claimFileId,
      claim.supplierAssignments.map((s) => s.vendorId),
    );
    if (!flags.muvafakatApproved) {
      throw new BadRequestException('Onarım öncesi muvafakatname dijital onayı yok.');
    }
    if (claim.supplierAssignments.length === 0) {
      throw new BadRequestException('Dosyada tedarikçi yok.');
    }
    if (!flags.repairPhotosReady) {
      throw new BadRequestException(
        'Her tedarikçinin onarım bitiş resmi yok. Resimler gelmeden hakediş ve bildirim açılamaz.',
      );
    }

    const status = await this.prisma.claimStatus.findFirst({ where: { code: 'repair_completed' } });
    if (status && claim.currentStatusId !== status.id) {
      await this.prisma.$transaction([
        this.prisma.claimFile.update({
          where: { id: claimFileId },
          data: { currentStatusId: status.id, lastActivityAt: new Date(), lastHumanActionAt: new Date() },
        }),
        this.prisma.claimStatusHistory.create({
          data: {
            claimFileId,
            fromStatusId: claim.currentStatusId,
            toStatusId: status.id,
            changedByUserId: this.actorId(actor),
            note: 'Onarım tamamlandı — yönetici ve finansa bildirildi.',
          },
        }),
      ]);
    }

    const staff = await this.prisma.user.findMany({
      where: {
        status: 'active',
        role: {
          code: {
            in: [
              'admin',
              'ADMIN',
              'manager',
              'MANAGER',
              'ops_manager',
              'OPS_MANAGER',
              'finance',
              'FINANCE',
              'finans',
              'FINANS',
              'accountant',
              'ACCOUNTANT',
            ],
          },
        },
      },
      select: { id: true, email: true, firstName: true, lastName: true },
      take: 60,
    });
    const vendorNames = claim.supplierAssignments.map((s) => s.vendor.name).join(', ');
    const mailResults: Array<{ to: string; sent: boolean }> = [];
    for (const u of staff) {
      const res = await this.claimEventEmail.onRepairCompleted({
        recipientEmail: u.email,
        recipientName: `${u.firstName ?? ''} ${u.lastName ?? ''}`.trim(),
        fileNo: claim.fileNo,
        claimFileId,
        vendorNames,
      });
      mailResults.push({ to: u.email, sent: !!res.sent });
    }
    await this.log(
      claimFileId,
      actor,
      'NOTE_ADDED',
      `Onarım bitti. Yönetici ve finansa mail (${mailResults.filter((m) => m.sent).length}/${mailResults.length}).`,
      { kind: 'repair_completed_email', purpose: 'onarim_bitti_fatura', results: mailResults },
    );
    return { ok: true, mailResults, flowFlags: await this.buildFlowFlags(claimFileId, claim.supplierAssignments.map((s) => s.vendorId)) };
  }
}
