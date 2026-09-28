import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';
import { PrismaService } from '@/prisma/prisma.service';
import { SystemSettingsService } from '@/modules/system-settings/system-settings.service';
import { EmailService } from '@/modules/notifications/email/email.service';
import {
  buildCrmSenderCopyNotice,
  canSendVisibleCopy,
  evaluateExpertWork,
  EXPERT_SILENCE_DISMISS_ACTION,
  EXPERT_SILENCE_OPENED_ACTION,
  EXPERT_SILENCE_SIGNAL_KEY,
  expertSilenceFileStillMissing,
  expertSilenceOwnerHeadline,
  isExpertFirmCustomer,
  matchCrmEmailWatchLog,
  prependFileOwnerCopyNotice,
  type ExpertWorkMemory,
} from '@sigorta/shared';

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
    private readonly emailService: EmailService,
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
    const expertWork = kind === 'customer' ? (await this.getExpertWorkMap([id]))[id] ?? null : null;

    return {
      success: true,
      data: {
        shortSummary: {
          lastContact: expertWork?.lastWorkAt ?? summary.lastContactAt,
          lastContactBy: this.latestOwner(visibleLogs, 'crm.note.created'),
          openFollowUp: summary.openFollowUp,
          latestOperation,
          risk: signals.find((signal) => signal.level === 'high' || signal.level === 'medium') ?? null,
        },
        cards: this.buildMemoryCards(kind as RelationshipKind, summary, operations, signals, customerOperationSummary),
        signals,
        links: this.buildOperationLinks(operations),
        customerOperationSummary,
        expertWork,
        sources: {
          crmNotes: summary.noteCount ?? 0,
          crmFollowUps: summary.followUpCount ?? 0,
          operations: operations.length,
          auditLogs: visibleLogs.length,
        },
      },
    };
  }

  async getExpertWorkMap(ids: unknown): Promise<Record<string, ExpertWorkMemory>> {
    const customerIds = Array.from(
      new Set((Array.isArray(ids) ? ids : []).map((id) => String(id ?? '').trim()).filter(Boolean)),
    ).slice(0, 400);
    if (customerIds.length === 0) return {};

    const customers = await this.prisma.customer.findMany({
      where: { id: { in: customerIds } },
      select: {
        id: true,
        subType: true,
        companyName: true,
        fullName: true,
        type: true,
        entityType: true,
      },
    });
    const expertIds = customers.filter((row) => isExpertFirmCustomer(row)).map((row) => row.id);
    if (expertIds.length === 0) return {};

    const [files, reports] = await Promise.all([
      this.prisma.claimFile.findMany({
        where: { customerId: { in: expertIds } },
        select: {
          id: true,
          customerId: true,
          createdAt: true,
          closedAt: true,
          currentStatus: { select: { code: true, name: true } },
          repairReports: {
            select: {
              status: true,
              updatedAt: true,
              externalApprovals: { select: { status: true, respondedAt: true } },
            },
          },
        },
      }),
      this.prisma.repairReport.findMany({
        where: { expertOfficeId: { in: expertIds } },
        select: {
          expertOfficeId: true,
          status: true,
          updatedAt: true,
          claimFile: {
            select: {
              id: true,
              createdAt: true,
              closedAt: true,
              currentStatus: { select: { code: true, name: true } },
            },
          },
          externalApprovals: { select: { status: true, respondedAt: true } },
        },
      }),
    ]);

    const buckets = new Map<string, { files: Map<string, { createdAt: Date; open: boolean }>; lastApprovedAt: Date | null }>();
    for (const id of expertIds) {
      buckets.set(id, { files: new Map(), lastApprovedAt: null });
    }

    const rememberFile = (
      officeId: string | null | undefined,
      file: { id: string; createdAt: Date; closedAt: Date | null; currentStatus?: { code?: string | null; name?: string | null } | null },
    ) => {
      if (!officeId) return;
      const bucket = buckets.get(officeId);
      if (!bucket) return;
      const previous = bucket.files.get(file.id);
      if (!previous || file.createdAt.getTime() > previous.createdAt.getTime()) {
        bucket.files.set(file.id, { createdAt: file.createdAt, open: this.isOpenFile(file) });
      }
    };

    const rememberApproval = (officeId: string | null | undefined, date: Date | null | undefined) => {
      if (!officeId || !date) return;
      const bucket = buckets.get(officeId);
      if (!bucket) return;
      if (!bucket.lastApprovedAt || date.getTime() > bucket.lastApprovedAt.getTime()) {
        bucket.lastApprovedAt = date;
      }
    };

    for (const file of files) {
      rememberFile(file.customerId, file);
      for (const report of file.repairReports) {
        rememberApproval(file.customerId, this.reportApprovalDate(report));
      }
    }

    for (const report of reports) {
      rememberFile(report.expertOfficeId, report.claimFile);
      rememberApproval(report.expertOfficeId, this.reportApprovalDate(report));
    }

    return Object.fromEntries(
      expertIds.map((id) => {
        const bucket = buckets.get(id) ?? { files: new Map(), lastApprovedAt: null };
        const fileRows = Array.from(bucket.files.values());
        const lastFileAt = fileRows.reduce<Date | null>((latest, row) => {
          if (!latest || row.createdAt.getTime() > latest.getTime()) return row.createdAt;
          return latest;
        }, null);
        return [
          id,
          evaluateExpertWork({
            fileCount: fileRows.length,
            openFileCount: fileRows.filter((row) => row.open).length,
            lastFileAt,
            lastApprovedAt: bucket.lastApprovedAt,
          }),
        ];
      }),
    );
  }

  async getMySilentExpertOffices(user: any) {
    const userId = this.userId(user);
    if (!userId) return [];
    const asManager = this.isManager(user);

    const files = await this.prisma.claimFile.findMany({
      where: asManager ? { assignedOfficeUserId: { not: null } } : { assignedOfficeUserId: userId },
      select: {
        assignedOfficeUserId: true,
        assignedOfficeUser: { select: { id: true, firstName: true, lastName: true } },
        customer: {
          select: {
            id: true,
            subType: true,
            companyName: true,
            fullName: true,
            type: true,
            entityType: true,
            city: true,
            email: true,
            phone: true,
          },
        },
        repairReports: {
          select: {
            expertOffice: {
              select: {
                id: true,
                subType: true,
                companyName: true,
                fullName: true,
                type: true,
                entityType: true,
                city: true,
                email: true,
                phone: true,
              },
            },
          },
        },
      },
    });

    const offices = new Map<string, {
      id: string;
      name: string;
      city: string | null;
      email: string | null;
      phone: string | null;
      ownerUserId: string | null;
      ownerName: string | null;
    }>();
    const remember = (
      row: {
        id?: string;
        subType?: string | null;
        companyName?: string | null;
        fullName?: string | null;
        type?: string | null;
        entityType?: string | null;
        city?: string | null;
        email?: string | null;
        phone?: string | null;
      } | null,
      owner: { id?: string | null; firstName?: string | null; lastName?: string | null } | null,
    ) => {
      if (!row?.id || !isExpertFirmCustomer(row)) return;
      const name = String(row.companyName ?? row.fullName ?? '').trim();
      if (!name) return;
      const ownerName = [owner?.firstName, owner?.lastName].filter(Boolean).join(' ').trim() || null;
      const previous = offices.get(row.id);
      offices.set(row.id, {
        id: row.id,
        name,
        city: row.city ?? previous?.city ?? null,
        email: row.email ?? previous?.email ?? null,
        phone: row.phone ?? previous?.phone ?? null,
        ownerUserId: owner?.id ?? previous?.ownerUserId ?? null,
        ownerName: ownerName ?? previous?.ownerName ?? null,
      });
    };
    for (const file of files) {
      remember(file.customer, file.assignedOfficeUser);
      for (const report of file.repairReports) remember(report.expertOffice, file.assignedOfficeUser);
    }

    const work = await this.getExpertWorkMap([...offices.keys()]);
    const silent = [...offices.values()].filter((office) => work[office.id]?.lane === 'silent');
    if (silent.length === 0) return [];

    const keys = silent.map((office) => this.key('customer', office.id));
    const logs = await this.prisma.auditLog.findMany({
      where: {
        entityType: CRM_ENTITY_TYPE,
        entityId: { in: keys },
        action: { in: ['crm.email.sent', 'crm.note.created', 'crm.follow_up.created'] },
      },
      orderBy: { createdAt: 'desc' },
      take: 400,
    });
    const latestByOffice = new Map<string, { action: string; createdAt: Date; value: any }>();
    for (const log of logs) {
      const officeId = String(log.entityId ?? '').split(':')[1];
      if (!officeId || latestByOffice.has(officeId)) continue;
      latestByOffice.set(officeId, { action: log.action, createdAt: log.createdAt, value: this.valueOf(log) });
    }

    return silent
      .map((office) => {
        const memory = work[office.id];
        const latest = latestByOffice.get(office.id);
        return {
          ...office,
          lane: memory?.lane ?? 'silent',
          silentDays: memory?.silentDays ?? null,
          lastWorkAt: memory?.lastWorkAt ?? null,
          lastFileAt: memory?.lastFileAt ?? null,
          lastAction: this.silentOfficeActionLabel(latest),
          canAct: office.ownerUserId === userId,
        };
      })
      .sort((a, b) => (b.silentDays ?? 0) - (a.silentDays ?? 0));
  }

  async recordSilenceWarningSignal(kind: 'dismissed' | 'opened', user: any, officeIds?: string[]) {
    const userId = this.userId(user);
    if (!userId) throw new BadRequestException('Oturum gerekli');
    const ids = Array.isArray(officeIds) ? officeIds.map((id) => String(id).trim()).filter(Boolean) : [];
    const action = kind === 'opened' ? EXPERT_SILENCE_OPENED_ACTION : EXPERT_SILENCE_DISMISS_ACTION;
    await this.writeLog(`${EXPERT_SILENCE_SIGNAL_KEY}:${userId}`, action, {
      ownerUserId: userId,
      ownerName: this.userName(user),
      officeIds: ids,
    }, user);
    return { ok: true };
  }

  async getSilenceActionReport(user: any) {
    if (!this.isManager(user)) {
      throw new ForbiddenException('Bu kayda erişiminiz yok.');
    }
    const silent = await this.getMySilentExpertOffices(user);
    if (silent.length === 0) return [];

    const officeKeys = silent.map((office) => this.key('customer', office.id));
    const ownerIds = [...new Set(silent.map((office) => office.ownerUserId).filter(Boolean))] as string[];
    const signalKeys = ownerIds.map((id) => `${EXPERT_SILENCE_SIGNAL_KEY}:${id}`);

    const [crmLogs, signalLogs] = await Promise.all([
      this.prisma.auditLog.findMany({
        where: {
          entityType: CRM_ENTITY_TYPE,
          entityId: { in: officeKeys },
          action: { in: ['crm.email.sent', 'crm.note.created', 'crm.follow_up.created'] },
        },
        orderBy: { createdAt: 'desc' },
        take: 800,
      }),
      signalKeys.length
        ? this.prisma.auditLog.findMany({
            where: {
              entityType: CRM_ENTITY_TYPE,
              entityId: { in: signalKeys },
              action: { in: [EXPERT_SILENCE_DISMISS_ACTION, EXPERT_SILENCE_OPENED_ACTION] },
            },
            orderBy: { createdAt: 'desc' },
            take: 400,
          })
        : Promise.resolve([]),
    ]);

    const byOwner = new Map<string, {
      ownerUserId: string;
      ownerName: string;
      dismissed: boolean;
      opened: boolean;
      customers: Array<{ name: string; action: string; note: string | null }>;
    }>();

    for (const office of silent) {
      const ownerUserId = office.ownerUserId || 'atanmamis';
      const ownerName = office.ownerName || 'Dosya Sorumlusu Atanmamış';
      if (!byOwner.has(ownerUserId)) {
        byOwner.set(ownerUserId, {
          ownerUserId,
          ownerName,
          dismissed: false,
          opened: false,
          customers: [],
        });
      }
      const bucket = byOwner.get(ownerUserId)!;
      const lastFileAt = office.lastFileAt ? new Date(office.lastFileAt).getTime() : 0;
      const latest = crmLogs.find((log) => {
        const officeId = String(log.entityId ?? '').split(':')[1];
        if (officeId !== office.id) return false;
        const actor = String(log.userId ?? this.valueOf(log)?.ownerUserId ?? '');
        if (office.ownerUserId && actor && actor !== office.ownerUserId) return false;
        return lastFileAt === 0 || log.createdAt.getTime() >= lastFileAt;
      });
      if (latest) {
        const value = this.valueOf(latest);
        const note = String(value?.summary ?? value?.result ?? value?.title ?? value?.body ?? '').trim() || null;
        const fileStillMissing = expertSilenceFileStillMissing({
          actedAt: latest.createdAt,
          lastFileAt: office.lastFileAt,
        });
        bucket.customers.push({
          name: office.name,
          action: this.silentOfficeActionLabel({ action: latest.action, createdAt: latest.createdAt, value }),
          note,
          fileStillMissing,
        });
      }
    }

    for (const log of signalLogs) {
      const ownerUserId = String(log.entityId ?? '').split(':')[1] || String(log.userId ?? '');
      const bucket = byOwner.get(ownerUserId);
      if (!bucket) continue;
      if (log.action === EXPERT_SILENCE_DISMISS_ACTION) bucket.dismissed = true;
      if (log.action === EXPERT_SILENCE_OPENED_ACTION) bucket.opened = true;
    }

    return [...byOwner.values()].map((row) => {
      const acted = row.customers.length > 0;
      return {
        ownerUserId: row.ownerUserId,
        ownerName: row.ownerName,
        acted,
        dismissed: row.dismissed,
        opened: row.opened,
        headline: expertSilenceOwnerHeadline({
          acted,
          dismissed: row.dismissed,
          opened: row.opened,
          customers: row.customers,
        }),
        customers: row.customers,
      };
    });
  }

  private silentOfficeActionLabel(latest?: { action: string; createdAt: Date; value: any } | null) {
    if (!latest) return 'Bekliyor';
    if (latest.action === 'crm.email.sent') {
      const watch = String(latest.value?.deliveryStatus ?? '');
      if (watch === 'bounced') return 'Ulaşmadı';
      if (watch === 'replied') return 'Yanıt geldi';
      return 'Yazıldı';
    }
    if (latest.action === 'crm.note.created' && latest.value?.noteType === 'phone_call') return 'Arandı';
    if (latest.action === 'crm.note.created') return 'Not düşüldü';
    if (latest.action === 'crm.follow_up.created' && String(latest.value?.result ?? '').includes('Tarih')) return 'Tarih bağlandı';
    if (latest.action === 'crm.follow_up.created') return 'Takip açık';
    return 'Bekliyor';
  }

  private reportApprovalDate(report: {
    status?: string | null;
    updatedAt?: Date | null;
    externalApprovals?: Array<{ status?: string | null; respondedAt?: Date | null }>;
  }) {
    const approved = new Set(['approved', 'externally_approved']);
    let latest: Date | null = null;
    const consider = (value?: Date | null) => {
      if (!value) return;
      if (!latest || value.getTime() > latest.getTime()) latest = value;
    };
    if (approved.has(String(report.status ?? ''))) consider(report.updatedAt ?? null);
    for (const row of report.externalApprovals ?? []) {
      if (String(row.status ?? '') === 'approved') consider(row.respondedAt ?? null);
    }
    return latest;
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
    const corporateSignature =
      typeof (this.systemSettings as any).getCorporateEmailSignature === 'function'
        ? await (this.systemSettings as any).getCorporateEmailSignature()
        : { companySignature: '', legalText: '' };
    const userSignature = this.buildUserSignature(user);
    const htmlBody = this.buildCrmEmailHtml(message, userSignature, corporateSignature.companySignature, corporateSignature.legalText);
    const textBody = [
      message,
      '',
      userSignature,
      '',
      corporateSignature.companySignature,
      '',
      corporateSignature.legalText,
    ].filter(Boolean).join('\n');

    const copy = await this.resolveSenderCopy(user, responsibleUserId, to);
    const counterpartName = await this.relationshipDisplayName(kind as RelationshipKind, id);
    const sentAt = new Date();
    const notice = copy
      ? buildCrmSenderCopyNotice({
          counterpartName,
          counterpartAddress: to,
          sender: copy,
          roleCode: copy.roleCode,
          sentAt,
        })
      : null;
    const html = notice ? prependFileOwnerCopyNotice(htmlBody, notice.html) : htmlBody;
    const text = notice ? `${notice.plain}\n\n${textBody}` : textBody;

    const sent = await this.emailService.sendEmail(to, subject, html, {
      text,
      mailbox: 'HASAR',
      cc: copy ? [{ email: copy.email, name: copy.name }] : undefined,
    });
    if (!sent.sent) {
      throw new BadRequestException(sent.errorMsg || 'E-posta gönderilemedi');
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
      sentAt: new Date().toISOString(),
      deliveryStatus: 'sent',
      emailLogId: sent.emailLogId ?? null,
      copyEmail: copy?.email ?? null,
      copyName: copy?.name ?? null,
    };
    const created = await this.writeLog(entityKey, 'crm.email.sent', payload, user);
    return { success: true, data: this.toEvent(created) };
  }

  async applyOutboundMailWatch(input: {
    kind: 'failed' | 'replied';
    fromAddress?: string | null;
    subject?: string | null;
    receivedAt: Date;
  }) {
    const logs = await this.prisma.auditLog.findMany({
      where: { entityType: CRM_ENTITY_TYPE, action: 'crm.email.sent' },
      orderBy: { createdAt: 'desc' },
      take: 400,
    });
    const mapped = logs.map((log) => ({ id: log.id, payload: this.valueOf(log) }));
    const logId = matchCrmEmailWatchLog(mapped, input);
    if (!logId) return;
    const row = logs.find((item) => item.id === logId);
    if (!row) return;
    const current = this.valueOf(row);
    const receivedAt = input.receivedAt.toISOString();
    const next =
      input.kind === 'failed'
        ? { ...current, deliveryStatus: 'bounced', bouncedAt: receivedAt }
        : { ...current, deliveryStatus: 'replied', repliedAt: receivedAt, bouncedAt: null };
    await this.prisma.auditLog.update({
      where: { id: logId },
      data: { newValue: next as Prisma.InputJsonValue },
    });
  }

  private async resolveSenderCopy(
    user: any,
    responsibleUserId: string | null,
    to: string,
  ): Promise<{ email: string; name: string; roleCode: string | null } | null> {
    const candidateIds = [user?.id, responsibleUserId].filter(
      (id, index, list): id is string => Boolean(id) && list.indexOf(id) === index,
    );
    for (const id of candidateIds) {
      const row = await this.prisma.user.findUnique({
        where: { id },
        select: {
          firstName: true,
          lastName: true,
          email: true,
          role: { select: { code: true } },
        },
      });
      const email = String(row?.email ?? '').trim();
      if (!canSendVisibleCopy(email, [to])) continue;
      return {
        email,
        name: this.userName(row) || email,
        roleCode: row?.role?.code ?? null,
      };
    }
    return null;
  }

  private async relationshipDisplayName(kind: RelationshipKind, id: string) {
    if (kind === 'customer') {
      const row = await this.prisma.customer.findUnique({
        where: { id },
        select: { shortName: true, companyName: true, fullName: true, firstName: true, lastName: true },
      });
      return (
        row?.shortName ||
        row?.companyName ||
        row?.fullName ||
        [row?.firstName, row?.lastName].filter(Boolean).join(' ') ||
        null
      );
    }
    if (kind === 'adjuster') {
      const row = await this.prisma.adjuster.findUnique({ where: { id }, select: { name: true } });
      return row?.name ?? null;
    }
    const row = await this.prisma.vendor.findUnique({ where: { id }, select: { name: true } });
    return row?.name ?? null;
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
