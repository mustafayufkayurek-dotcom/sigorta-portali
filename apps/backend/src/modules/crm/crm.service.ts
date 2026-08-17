import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';
import * as nodemailer from 'nodemailer';
import { PrismaService } from '@/prisma/prisma.service';
import { SystemSettingsService } from '@/modules/system-settings/system-settings.service';

type RelationshipKind = 'customer' | 'adjuster' | 'vendor';
type CrmVisibility = 'everyone' | 'responsible' | 'managers';

const RELATIONSHIP_KINDS = ['customer', 'adjuster', 'vendor'] as const;
const CRM_ENTITY_TYPE = 'crm_relationship';

const CRM_STATUSES = new Set([
  'candidate',
  'contacted',
  'proposal_sent',
  'waiting',
  'active',
  'passive',
  'lost',
]);

const NOTE_TYPES = new Set(['general', 'phone_call', 'meeting', 'visit', 'email']);
const FOLLOW_UP_STATUSES = new Set(['open', 'done', 'postponed', 'cancelled']);
const CRM_VISIBILITIES = new Set(['everyone', 'responsible', 'managers']);

@Injectable()
export class CrmService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly systemSettings: SystemSettingsService,
  ) {}

  async getSummaries(relationships: Array<{ kind: string; id: string }>, user?: any) {
    const keys = relationships
      .filter((item) => this.isValidKind(item?.kind) && typeof item?.id === 'string' && item.id)
      .map((item) => this.key(item.kind as RelationshipKind, item.id));

    if (keys.length === 0) {
      return { success: true, data: {} };
    }

    const logs = await this.prisma.auditLog.findMany({
      where: {
        entityType: CRM_ENTITY_TYPE,
        entityId: { in: Array.from(new Set(keys)) },
      },
      orderBy: { createdAt: 'desc' },
      take: 1000,
    });

    const visibleLogs = this.visibleLogs(logs, user);
    const data = Array.from(new Set(keys)).reduce<Record<string, any>>((acc, key) => {
      acc[key] = this.buildSummary(visibleLogs.filter((log) => log.entityId === key));
      return acc;
    }, {});

    return { success: true, data };
  }

  async getActivity(kind: string, id: string, user?: any) {
    const entityKey = await this.assertRelationship(kind, id);
    const logs = await this.prisma.auditLog.findMany({
      where: { entityType: CRM_ENTITY_TYPE, entityId: entityKey },
      include: { user: { select: { id: true, firstName: true, lastName: true, email: true } } },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    const visibleLogs = this.visibleLogs(logs, user);

    return {
      success: true,
      data: {
        summary: this.buildSummary(visibleLogs),
        events: visibleLogs.map((log) => this.toEvent(log)),
      },
    };
  }

  async getMemory(kind: string, id: string, user?: any) {
    const entityKey = await this.assertRelationship(kind, id);
    const logs = await this.prisma.auditLog.findMany({
      where: { entityType: CRM_ENTITY_TYPE, entityId: entityKey },
      include: { user: { select: { id: true, firstName: true, lastName: true, email: true } } },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    const visibleLogs = this.visibleLogs(logs, user);
    const summary = this.buildSummary(visibleLogs);
    const operations = await this.getOperations(kind as RelationshipKind, id);
    const signals = this.buildMemorySignals(kind as RelationshipKind, summary, operations);
    const latestOperation = operations[0] ?? null;
    const customerOperationSummary = kind === 'customer' ? await this.getCustomerOperationSummary(id) : null;

    return {
      success: true,
      data: {
        shortSummary: {
          lastContact: summary.lastContactAt,
          lastContactBy: this.latestOwner(visibleLogs, 'crm.note.created'),
          openFollowUp: summary.openFollowUp,
          latestOperation,
          risk: signals.find((signal) => signal.level === 'high' || signal.level === 'medium') ?? null,
        },
        cards: this.buildMemoryCards(kind as RelationshipKind, summary, operations, signals, customerOperationSummary),
        signals,
        links: this.buildOperationLinks(operations),
        customerOperationSummary,
        sources: {
          crmNotes: summary.noteCount ?? 0,
          crmFollowUps: summary.followUpCount ?? 0,
          operations: operations.length,
          auditLogs: visibleLogs.length,
        },
      },
    };
  }

  private async getCustomerOperationSummary(customerId: string) {
    const files = await this.prisma.claimFile.findMany({
      where: { customerId },
      select: {
        id: true,
        createdAt: true,
        updatedAt: true,
        closedAt: true,
        invoicedAmount: true,
        actualCostAmount: true,
        profitAmount: true,
        currentStatus: { select: { code: true, name: true } },
        fileRevenues: { select: { totalAmount: true, status: true } },
        costEntries: { select: { amount: true } },
      },
    });

    const totalFiles = files.length;
    const openFiles = files.filter((file) => this.isOpenFile(file)).length;
    const totalRevenue = files.reduce((sum, file) => sum + this.fileRevenue(file), 0);
    const totalCost = files.reduce((sum, file) => sum + this.fileCost(file), 0);
    const totalProfit = files.reduce((sum, file) => sum + this.fileProfit(file), 0);
    const durations = files
      .map((file) => this.fileDurationDays(file))
      .filter((value): value is number => value !== null);
    const averageFileDurationDays = durations.length
      ? Math.round(durations.reduce((sum, value) => sum + value, 0) / durations.length)
      : null;
    const lastOperationDate = files
      .map((file) => file.updatedAt ?? file.createdAt)
      .sort((a, b) => b.getTime() - a.getTime())[0] ?? null;

    return {
      totalFiles,
      openFiles,
      totalRevenue,
      totalProfit,
      averageFileDurationDays,
      lastOperationDate: lastOperationDate?.toISOString() ?? null,
      currency: 'TRY',
      totalCost,
    };
  }

  async createNote(kind: string, id: string, body: any, user: any) {
    const entityKey = await this.assertRelationship(kind, id);
    const noteType = this.normalizeNoteType(body?.noteType);
    const summary = this.requiredText(body?.summary, 'Not ozeti zorunlu');
    const occurredAt = this.optionalDate(body?.occurredAt) ?? new Date();
    const visibility = this.normalizeVisibility(body?.visibility ?? 'everyone');
    const responsibleUserId = this.optionalText(body?.responsibleUserId) ?? user.id;
    const responsibleName = this.optionalText(body?.responsibleName) ?? this.userName(user);

    const payload = {
      eventId: randomUUID(),
      kind,
      id,
      noteType,
      summary,
      body: this.optionalText(body?.body),
      occurredAt: occurredAt.toISOString(),
      visibility,
      ownerUserId: user.id,
      ownerName: this.userName(user),
      responsibleUserId,
      responsibleName,
    };

    const created = await this.writeLog(entityKey, 'crm.note.created', payload, user);
    return { success: true, data: this.toEvent(created) };
  }

  async createFollowUp(kind: string, id: string, body: any, user: any) {
    const entityKey = await this.assertRelationship(kind, id);
    const dueAt = this.requiredDate(body?.dueAt, 'Takip tarihi zorunlu');
    const title = this.requiredText(body?.title ?? body?.result ?? body?.summary, 'Takip sonucu/ozeti zorunlu');
    const status = this.normalizeFollowUpStatus(body?.status ?? 'open');
    const visibility = this.normalizeVisibility(body?.visibility ?? 'everyone');
    const responsibleUserId = this.optionalText(body?.responsibleUserId) ?? user.id;
    const responsibleName = this.optionalText(body?.responsibleName) ?? this.userName(user);

    const payload = {
      followUpId: randomUUID(),
      kind,
      id,
      title,
      result: this.optionalText(body?.result),
      dueAt: dueAt.toISOString(),
      status,
      visibility,
      ownerUserId: user.id,
      ownerName: this.userName(user),
      responsibleUserId,
      responsibleName,
    };

    const created = await this.writeLog(entityKey, 'crm.follow_up.created', payload, user);
    return { success: true, data: this.toEvent(created) };
  }

  async updateStatus(kind: string, id: string, body: any, user: any) {
    const entityKey = await this.assertRelationship(kind, id);
    const status = this.normalizeCrmStatus(body?.status);
    const result = this.optionalText(body?.result);
    const visibility = this.normalizeVisibility(body?.visibility ?? 'everyone');
    const responsibleUserId = this.optionalText(body?.responsibleUserId) ?? user.id;
    const responsibleName = this.optionalText(body?.responsibleName) ?? this.userName(user);

    const payload = {
      eventId: randomUUID(),
      kind,
      id,
      status,
      result,
      visibility,
      ownerUserId: user.id,
      ownerName: this.userName(user),
      responsibleUserId,
      responsibleName,
    };

    const created = await this.writeLog(entityKey, 'crm.status.changed', payload, user);
    return { success: true, data: this.toEvent(created) };
  }

  async updateFollowUp(kind: string, id: string, followUpId: string, body: any, user: any) {
    const entityKey = await this.assertRelationship(kind, id);
    const status = this.normalizeFollowUpStatus(body?.status);
    const previous = await this.latestFollowUpValue(entityKey, followUpId);
    const visibility = this.normalizeVisibility(body?.visibility ?? previous?.visibility ?? 'everyone');
    const responsibleUserId = this.optionalText(body?.responsibleUserId) ?? previous?.responsibleUserId ?? user.id;
    const responsibleName = this.optionalText(body?.responsibleName) ?? previous?.responsibleName ?? this.userName(user);

    const payload = {
      followUpId,
      kind,
      id,
      status,
      result: this.optionalText(body?.result),
      visibility,
      ownerUserId: user.id,
      ownerName: this.userName(user),
      responsibleUserId,
      responsibleName,
    };

    const created = await this.writeLog(entityKey, 'crm.follow_up.updated', payload, user);
    return { success: true, data: this.toEvent(created) };
  }

  async sendEmail(kind: string, id: string, body: any, user: any) {
    const entityKey = await this.assertRelationship(kind, id);
    const to = this.requiredEmail(body?.to);
    const subject = this.requiredText(body?.subject, 'E-posta konusu zorunlu');
    const message = this.requiredText(body?.message, 'E-posta icerigi zorunlu');
    const visibility = this.normalizeVisibility(body?.visibility ?? 'everyone');
    const responsibleUserId = this.optionalText(body?.responsibleUserId) ?? user.id;
    const responsibleName = this.optionalText(body?.responsibleName) ?? this.userName(user);
    const mailConfig = await this.systemSettings.getMailConfig();

    if (!mailConfig?.host || !mailConfig.username || !mailConfig.password) {
      throw new BadRequestException('Mail yapilandirmasi eksik veya henuz kaydedilmemis');
    }

    const corporateSignature =
      typeof (this.systemSettings as any).getCorporateEmailSignature === 'function'
        ? await (this.systemSettings as any).getCorporateEmailSignature()
        : { companySignature: '', legalText: '' };
    const userSignature = this.buildUserSignature(user);
    const html = this.buildCrmEmailHtml(message, userSignature, corporateSignature.companySignature, corporateSignature.legalText);
    const text = [
      message,
      '',
      userSignature,
      '',
      corporateSignature.companySignature,
      '',
      corporateSignature.legalText,
    ].filter(Boolean).join('\n');
    const logEntry = await this.prisma.emailLog.create({
      data: { to, subject, status: 'queued' },
    });

    const transportOptions: nodemailer.TransportOptions = {
      host: mailConfig.host,
      port: mailConfig.port || 587,
      secure: mailConfig.security === 'SSL',
      auth: {
        user: mailConfig.username,
        pass: mailConfig.password,
      },
    } as nodemailer.TransportOptions;

    if (mailConfig.security === 'TLS') {
      (transportOptions as any).requireTLS = true;
    }

    const transporter = nodemailer.createTransport(transportOptions);
    try {
      const result = await transporter.sendMail({
        from: `"${mailConfig.fromName || 'Meridyen Assistance'}" <${mailConfig.fromEmail || mailConfig.username}>`,
        to,
        subject,
        text,
        html,
      });
      const rejected = (result.rejected ?? []).map(String);
      await this.prisma.emailLog.update({
        where: { id: logEntry.id },
        data: {
          status: rejected.length ? 'failed' : 'sent',
          sentAt: rejected.length ? null : new Date(),
          errorMsg: rejected.length ? `Reddedilen alicilar: ${rejected.join(', ')}` : null,
        },
      });

      if (rejected.length) {
        throw new BadRequestException('E-posta SMTP tarafinda reddedildi');
      }

      const payload = {
        eventId: randomUUID(),
        kind,
        id,
        to,
        subject,
        message,
        visibility,
        ownerUserId: user.id,
        ownerName: this.userName(user),
        responsibleUserId,
        responsibleName,
        emailLogId: logEntry.id,
        sentAt: new Date().toISOString(),
      };
      const created = await this.writeLog(entityKey, 'crm.email.sent', payload, user);
      return { success: true, data: this.toEvent(created) };
    } catch (err: any) {
      await this.prisma.emailLog.update({
        where: { id: logEntry.id },
        data: {
          status: 'failed',
          errorMsg: err?.message ?? 'E-posta gonderilemedi',
        },
      }).catch(() => null);
      if (err instanceof BadRequestException) throw err;
      throw new BadRequestException(err?.message ?? 'E-posta gonderilemedi');
    }
  }

  private async assertRelationship(kind: string, id: string) {
    if (!this.isValidKind(kind)) {
      throw new BadRequestException('Gecersiz CRM iliski turu');
    }
    if (!id || typeof id !== 'string') {
      throw new BadRequestException('CRM iliski kimligi zorunlu');
    }

    const exists = await this.exists(kind, id);
    if (!exists) {
      throw new NotFoundException('CRM iliskisi bulunamadi');
    }

    return this.key(kind, id);
  }

  private exists(kind: RelationshipKind, id: string) {
    if (kind === 'customer') {
      return this.prisma.customer.findUnique({ where: { id }, select: { id: true } });
    }
    if (kind === 'adjuster') {
      return this.prisma.adjuster.findUnique({ where: { id }, select: { id: true } });
    }
    return this.prisma.vendor.findUnique({ where: { id }, select: { id: true } });
  }

  private buildSummary(logs: any[]) {
    const latestStatusLog = logs.find((log) => log.action === 'crm.status.changed');
    const latestNoteLog = logs.find((log) => log.action === 'crm.note.created');
    const followUpLogs = logs.filter((log) => log.action === 'crm.follow_up.created' || log.action === 'crm.follow_up.updated');
    const followUps = new Map<string, any>();

    for (const log of [...followUpLogs].reverse()) {
      const value = this.valueOf(log);
      if (value?.followUpId) followUps.set(value.followUpId, { ...value, createdAt: log.createdAt });
    }

    const openFollowUp = Array.from(followUps.values())
      .filter((item) => item.status === 'open' || item.status === 'postponed')
      .sort((a, b) => new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime())[0] ?? null;

    const latestNote = latestNoteLog ? this.valueOf(latestNoteLog) : null;

    return {
      crmStatus: latestStatusLog ? this.valueOf(latestStatusLog)?.status : null,
      lastContactAt: latestNote?.occurredAt ?? null,
      lastNoteSummary: latestNote?.summary ?? null,
      openFollowUp,
      noteCount: logs.filter((log) => log.action === 'crm.note.created').length,
      followUpCount: followUps.size,
    };
  }

  private toEvent(log: any) {
    return {
      id: log.id,
      action: log.action,
      createdAt: log.createdAt,
      user: log.user
        ? { id: log.user.id, name: this.userName(log.user), email: log.user.email }
        : null,
      value: this.valueOf(log),
    };
  }

  private async getOperations(kind: RelationshipKind, id: string) {
    if (kind === 'customer') {
      const [claimFiles, emergencyCases, repairReports] = await Promise.all([
        this.prisma.claimFile.findMany({
          where: { customerId: id },
          select: {
            id: true,
            fileNo: true,
            productBranch: true,
            priority: true,
            updatedAt: true,
            createdAt: true,
            currentStatus: { select: { name: true, code: true } },
          },
          orderBy: { updatedAt: 'desc' },
          take: 5,
        }),
        this.prisma.emergencyCase.findMany({
          where: { customerId: id },
          select: { id: true, caseNo: true, issueType: true, urgency: true, status: true, updatedAt: true, createdAt: true },
          orderBy: { updatedAt: 'desc' },
          take: 5,
        }),
        this.prisma.repairReport.findMany({
          where: { expertOfficeId: id },
          select: { id: true, reportNo: true, status: true, reportDate: true, updatedAt: true, claimFile: { select: { id: true, fileNo: true } } },
          orderBy: { updatedAt: 'desc' },
          take: 5,
        }),
      ]);
      return [
        ...claimFiles.map((item) => this.operationItem('claim_file', item.id, item.fileNo, item.currentStatus?.name, item.updatedAt, `/panel/hasar-dosyalari/${item.id}`, item.productBranch, item.priority)),
        ...emergencyCases.map((item) => this.operationItem('emergency_case', item.id, item.caseNo, String(item.status), item.updatedAt, `/panel/acil-yardim/${item.id}`, item.issueType, String(item.urgency))),
        ...repairReports.map((item) => this.operationItem('repair_report', item.id, item.reportNo, item.status, item.updatedAt, `/panel/hasar-dosyalari/${item.claimFile.id}/onarim-raporu/${item.id}`, item.claimFile.fileNo)),
      ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 8);
    }

    if (kind === 'adjuster') {
      const assignments = await this.prisma.adjusterAssignment.findMany({
        where: { adjusterId: id },
        select: {
          id: true,
          status: true,
          updatedAt: true,
          assignedAt: true,
          claimFile: { select: { id: true, fileNo: true, productBranch: true } },
          report: { select: { id: true, reportNo: true, status: true, reportDate: true } },
        },
        orderBy: { updatedAt: 'desc' },
        take: 8,
      });
      return assignments.map((item) => this.operationItem(
        'adjuster_assignment',
        item.id,
        item.claimFile.fileNo,
        item.report?.status ?? item.status,
        item.updatedAt,
        `/panel/hasar-dosyalari/${item.claimFile.id}`,
        item.report?.reportNo ?? item.claimFile.productBranch,
      ));
    }

    const [claimFiles, emergencyCases, contracts] = await Promise.all([
      this.prisma.claimFile.findMany({
        where: {
          OR: [
            { assignedSupplierId: id },
            { supplierAssignments: { some: { vendorId: id } } },
          ],
        },
        select: { id: true, fileNo: true, priority: true, updatedAt: true, currentStatus: { select: { name: true } } },
        orderBy: { updatedAt: 'desc' },
        take: 5,
      }),
      this.prisma.emergencyCase.findMany({
        where: { assignedVendorId: id },
        select: { id: true, caseNo: true, issueType: true, urgency: true, status: true, updatedAt: true },
        orderBy: { updatedAt: 'desc' },
        take: 5,
      }),
      this.prisma.vendorContract.findMany({
        where: { vendorId: id },
        select: { id: true, contractNo: true, status: true, updatedAt: true, claimFileId: true, fileNo: true },
        orderBy: { updatedAt: 'desc' },
        take: 5,
      }),
    ]);

    return [
      ...claimFiles.map((item) => this.operationItem('claim_file', item.id, item.fileNo, item.currentStatus?.name, item.updatedAt, `/panel/hasar-dosyalari/${item.id}`, undefined, item.priority)),
      ...emergencyCases.map((item) => this.operationItem('emergency_case', item.id, item.caseNo, String(item.status), item.updatedAt, `/panel/acil-yardim/${item.id}`, item.issueType, String(item.urgency))),
      ...contracts.map((item) => this.operationItem('vendor_contract', item.id, item.contractNo, item.status, item.updatedAt, `/panel/hasar-dosyalari/${item.claimFileId}`, item.fileNo)),
    ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 8);
  }

  private buildMemorySignals(kind: RelationshipKind, summary: any, operations: any[]) {
    const signals: Array<{ label: string; level: 'low' | 'medium' | 'high'; detail: string }> = [];
    const now = Date.now();
    const openDue = summary.openFollowUp?.dueAt ? new Date(summary.openFollowUp.dueAt).getTime() : null;
    const lastContact = summary.lastContactAt ? new Date(summary.lastContactAt).getTime() : null;

    if (openDue && openDue < now) {
      signals.push({ label: 'Geciken takip', level: 'high', detail: summary.openFollowUp?.title ?? 'Takip tarihi gecmis' });
    } else if (openDue) {
      signals.push({ label: 'Acik takip', level: 'medium', detail: summary.openFollowUp?.title ?? 'Takip bekliyor' });
    }

    if (!lastContact || now - lastContact > 1000 * 60 * 60 * 24 * 30) {
      signals.push({ label: 'Uzun suredir temas yok', level: 'medium', detail: 'Son 30 gunde CRM notu yok' });
    }

    if (kind === 'vendor' && operations.some((item) => String(item.status).toLowerCase().includes('risk'))) {
      signals.push({ label: 'Riskli tedarikci', level: 'high', detail: 'Operasyon kaydinda risk sinyali var' });
    }

    if (kind === 'adjuster' && operations.length > 0 && !operations.some((item) => String(item.status).toLowerCase().includes('report'))) {
      signals.push({ label: 'Performans izlenmeli', level: 'low', detail: 'Son atamalarda rapor sinyali sinirli' });
    }

    return signals;
  }

  private buildMemoryCards(kind: RelationshipKind, summary: any, operations: any[], signals: any[], customerOperationSummary?: any) {
    const latest = operations[0];
    if (kind === 'customer') {
      return [
        { label: 'Son temas', value: this.dateOrEmpty(summary.lastContactAt), detail: summary.lastNoteSummary ?? 'Son gorusme ozeti yok', tone: 'blue' },
        { label: 'Sonraki aksiyon', value: summary.openFollowUp?.title ?? 'Planlanmamis', detail: summary.openFollowUp ? this.dateOrEmpty(summary.openFollowUp.dueAt) : 'Aksiyon beklemiyor', tone: summary.openFollowUp ? 'amber' : 'slate' },
        { label: 'Acik takip ozeti', value: summary.openFollowUp?.result ?? summary.openFollowUp?.title ?? 'Yok', detail: summary.openFollowUp?.ownerName ?? 'Bekleyen takip yok', tone: summary.openFollowUp ? 'amber' : 'slate' },
        { label: 'Operasyon degeri', value: this.moneyOrEmpty(customerOperationSummary?.totalRevenue), detail: `Kar: ${this.moneyOrEmpty(customerOperationSummary?.totalProfit)}`, tone: 'emerald' },
      ];
    }
    if (kind === 'adjuster') {
      return [
        { label: 'Son atama', value: latest?.title ?? 'Kayit yok', detail: this.dateOrEmpty(latest?.date), tone: 'blue' },
        { label: 'Son rapor', value: operations.find((item) => item.type === 'adjuster_assignment')?.meta ?? 'Kayit yok', detail: latest?.status ?? '-', tone: 'slate' },
        { label: 'Performans sinyali', value: signals[0]?.label ?? 'Normal', detail: signals[0]?.detail ?? 'Kritik sinyal yok', tone: signals[0] ? 'amber' : 'emerald' },
        { label: 'Acik konu', value: summary.openFollowUp?.title ?? 'Yok', detail: summary.openFollowUp ? this.dateOrEmpty(summary.openFollowUp.dueAt) : 'Bekleyen takip yok', tone: summary.openFollowUp ? 'amber' : 'slate' },
      ];
    }
    return [
      { label: 'Son is', value: latest?.title ?? 'Kayit yok', detail: this.dateOrEmpty(latest?.date), tone: 'blue' },
      { label: 'Son sozlesme', value: operations.find((item) => item.type === 'vendor_contract')?.title ?? 'Kayit yok', detail: operations.find((item) => item.type === 'vendor_contract')?.status ?? '-', tone: 'slate' },
      { label: 'Risk sinyali', value: signals[0]?.label ?? 'Yok', detail: signals[0]?.detail ?? 'Gorunur risk yok', tone: signals[0]?.level === 'high' ? 'rose' : signals[0] ? 'amber' : 'emerald' },
      { label: 'Acik konu', value: summary.openFollowUp?.title ?? 'Yok', detail: summary.openFollowUp ? this.dateOrEmpty(summary.openFollowUp.dueAt) : 'Bekleyen takip yok', tone: summary.openFollowUp ? 'amber' : 'slate' },
    ];
  }

  private buildOperationLinks(operations: any[]) {
    return operations.slice(0, 4).map((item) => ({ label: item.title, href: item.href, type: item.type, status: item.status }));
  }

  private operationItem(type: string, id: string, title: string, status: string | null | undefined, date: Date, href: string, meta?: string, signal?: string) {
    return {
      type,
      id,
      title,
      status: status ?? 'Kayit',
      date: date.toISOString(),
      href,
      meta: meta ?? null,
      signal: signal ?? null,
    };
  }

  private latestOwner(logs: any[], action: string) {
    const log = logs.find((item) => item.action === action);
    return log ? this.valueOf(log)?.ownerName ?? this.userName(log.user) : null;
  }

  private visibleLogs(logs: any[], user?: any) {
    return logs.filter((log) => this.canSeeLog(log, user));
  }

  private canSeeLog(log: any, user?: any) {
    const value = this.valueOf(log);
    const visibility = this.visibilityOf(value);
    if (visibility === 'everyone') return true;
    if (this.isManager(user)) return true;

    const userId = this.userId(user);
    if (!userId) return false;
    return value?.ownerUserId === userId || value?.responsibleUserId === userId;
  }

  private userId(user?: any) {
    return String(user?.id ?? user?.userId ?? '').trim();
  }

  private isManager(user?: any) {
    const roleCode = String(user?.roleCode ?? user?.role?.code ?? '').toUpperCase();
    return ['ADMIN', 'SUPER_ADMIN', 'MANAGER', 'OPS_MANAGER'].includes(roleCode);
  }

  private visibilityOf(value: any): CrmVisibility {
    const visibility = String(value?.visibility ?? 'everyone').trim();
    return CRM_VISIBILITIES.has(visibility) ? visibility as CrmVisibility : 'everyone';
  }

  private async latestFollowUpValue(entityId: string, followUpId: string) {
    const logs = await this.prisma.auditLog.findMany({
      where: {
        entityType: CRM_ENTITY_TYPE,
        entityId,
        action: { in: ['crm.follow_up.created', 'crm.follow_up.updated'] },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    return logs.map((log) => this.valueOf(log)).find((value) => value?.followUpId === followUpId) ?? null;
  }

  private isOpenFile(file: any) {
    const status = `${file.currentStatus?.code ?? ''} ${file.currentStatus?.name ?? ''}`.toLowerCase();
    if (file.closedAt) return false;
    return !['closed', 'cancelled', 'canceled', 'kapandi', 'kapandı', 'iptal', 'tamamlandi', 'tamamlandı'].some((token) => status.includes(token));
  }

  private fileRevenue(file: any) {
    if (typeof file.invoicedAmount === 'number') return file.invoicedAmount;
    return (file.fileRevenues ?? [])
      .filter((revenue: any) => revenue.status !== 'cancelled')
      .reduce((sum: number, revenue: any) => sum + Number(revenue.totalAmount ?? 0), 0);
  }

  private fileCost(file: any) {
    if (typeof file.actualCostAmount === 'number') return file.actualCostAmount;
    return (file.costEntries ?? []).reduce((sum: number, cost: any) => sum + Number(cost.amount ?? 0), 0);
  }

  private fileProfit(file: any) {
    if (typeof file.profitAmount === 'number') return file.profitAmount;
    return this.fileRevenue(file) - this.fileCost(file);
  }

  private fileDurationDays(file: any) {
    const start = file.createdAt ? new Date(file.createdAt).getTime() : null;
    if (!start) return null;
    const end = file.closedAt ? new Date(file.closedAt).getTime() : new Date(file.updatedAt ?? Date.now()).getTime();
    if (Number.isNaN(start) || Number.isNaN(end)) return null;
    return Math.max(0, Math.ceil((end - start) / (1000 * 60 * 60 * 24)));
  }

  private moneyOrEmpty(value: unknown) {
    const amount = Number(value ?? 0);
    if (!Number.isFinite(amount) || amount === 0) return '0 TRY';
    return `${Math.round(amount).toLocaleString('tr-TR')} TRY`;
  }

  private dateOrEmpty(value?: string | Date | null) {
    if (!value) return 'Yok';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'Yok';
    return date.toISOString();
  }

  private async writeLog(entityId: string, action: string, newValue: Record<string, unknown>, user: any) {
    return this.prisma.auditLog.create({
      data: {
        entityType: CRM_ENTITY_TYPE,
        entityId,
        action,
        newValue: newValue as Prisma.InputJsonValue,
        userId: user.id,
        userEmail: user.email ?? null,
      },
      include: { user: { select: { id: true, firstName: true, lastName: true, email: true } } },
    });
  }

  private valueOf(log: any) {
    return log?.newValue && typeof log.newValue === 'object' ? log.newValue : {};
  }

  private key(kind: RelationshipKind, id: string) {
    return `${kind}:${id}`;
  }

  private isValidKind(kind: string): kind is RelationshipKind {
    return RELATIONSHIP_KINDS.includes(kind as RelationshipKind);
  }

  private normalizeCrmStatus(value: unknown) {
    const status = String(value ?? '').trim();
    if (!CRM_STATUSES.has(status)) {
      throw new BadRequestException('Gecersiz CRM durumu');
    }
    return status;
  }

  private normalizeNoteType(value: unknown) {
    const noteType = String(value ?? 'general').trim();
    if (!NOTE_TYPES.has(noteType)) {
      throw new BadRequestException('Gecersiz CRM not tipi');
    }
    return noteType;
  }

  private normalizeFollowUpStatus(value: unknown) {
    const status = String(value ?? 'open').trim();
    if (!FOLLOW_UP_STATUSES.has(status)) {
      throw new BadRequestException('Gecersiz takip durumu');
    }
    return status;
  }

  private normalizeVisibility(value: unknown): CrmVisibility {
    const visibility = String(value ?? 'everyone').trim();
    if (!CRM_VISIBILITIES.has(visibility)) {
      throw new BadRequestException('Gecersiz CRM gorunurluk seviyesi');
    }
    return visibility as CrmVisibility;
  }

  private requiredEmail(value: unknown) {
    const email = this.requiredText(value, 'Alici e-posta adresi zorunlu').toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new BadRequestException('Gecerli bir alici e-posta adresi giriniz');
    }
    return email;
  }

  private requiredText(value: unknown, message: string) {
    const text = String(value ?? '').trim();
    if (!text) throw new BadRequestException(message);
    return text;
  }

  private optionalText(value: unknown) {
    const text = String(value ?? '').trim();
    return text || null;
  }

  private requiredDate(value: unknown, message: string) {
    const date = this.optionalDate(value);
    if (!date) throw new BadRequestException(message);
    return date;
  }

  private optionalDate(value: unknown) {
    if (!value) return null;
    const date = new Date(String(value));
    if (Number.isNaN(date.getTime())) {
      throw new BadRequestException('Gecersiz tarih');
    }
    return date;
  }

  private userName(user: any) {
    return [user?.firstName, user?.lastName].filter(Boolean).join(' ') || user?.email || 'Kullanici';
  }

  private buildUserSignature(user: any) {
    const name = this.userName(user);
    const email = user?.email ? String(user.email) : '';
    return [name, email].filter(Boolean).join('\n');
  }

  private buildCrmEmailHtml(message: string, userSignature: string, companySignature: string, legalText: string) {
    const block = (value: string) => this.escapeHtml(value).replace(/\n/g, '<br />');
    return `
      <div style="font-family:Arial,sans-serif;color:#0f172a;font-size:14px;line-height:1.6">
        <div>${block(message)}</div>
        <div style="margin-top:20px;border-top:1px solid #e2e8f0;padding-top:14px">${block(userSignature)}</div>
        <div style="margin-top:12px;color:#1d4ed8;font-weight:600">${block(companySignature)}</div>
        <div style="margin-top:14px;color:#64748b;font-size:12px">${block(legalText)}</div>
      </div>
    `;
  }

  private escapeHtml(value: string) {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
}
