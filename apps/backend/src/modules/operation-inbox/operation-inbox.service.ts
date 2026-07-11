import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { PrismaService } from '@/prisma/prisma.service';
import {
  EmergencyUrgency,
  InboundMailbox,
  InboundMessage,
  InboundMessageStatus,
  Prisma,
} from '@prisma/client';
import { ClaimFilesService } from '../claim-files/claim-files.service';
import { CustomersService } from '../customers/customers.service';
import { EmergencyCasesService } from '../emergency/emergency-cases.service';
import { NotesService } from '../notes/notes.service';
import { SystemSettingsService } from '../system-settings/system-settings.service';
import { AssignMessageDto } from './dto/assign-message.dto';
import { LinkClaimFileDto } from './dto/link-claim-file.dto';
import { LinkEmergencyFileDto } from './dto/link-emergency-file.dto';
import { OpenClaimFileDto } from './dto/open-claim-file.dto';
import { OpenEmergencyFileDto } from './dto/open-emergency-file.dto';
import { ReplyMessageDto } from './dto/reply-message.dto';
import { ComposeMessageDto } from './dto/compose-message.dto';
import { CreateCustomerFromInboxDto } from './dto/create-customer-from-inbox.dto';
import { GraphMailSendService } from './graph/graph-mail-send.service';
import { InboundRoutingService, InboundRoutingSuggestion } from './inbound-routing.service';
import { extractHeuristicFields } from './inbound-heuristic-parser';
import { mapInboundCategoryToMeridyen, mapInboundLossTypeToMeridyen, resolveInsuredPhoneForInbox } from '@sigorta/shared';
import { isCorporateInboxSender, splitPersonName } from './inbound-sender-profile';
import {
  resolveInsuredEmailForInbox,
  shouldCreateInsuredWithoutEmailOnDuplicate,
} from './inbound-insured-contact.util';
import { OperationInboxNotificationService } from './operation-inbox-notification.service';
import { OperationalAccessGrantsService } from '../operational-access-grants/operational-access-grants.service';
import {
  FileMatchCandidate,
  InboundFileMatcherService,
} from './inbound-file-matcher.service';
import { extractSubjectHints } from './inbound-subject-parser';
import {
  INBOUND_INGEST_QUEUE,
  INGEST_JOB_SYNC_MAILBOX,
  SYNC_JOB_OPTIONS,
} from './operation-inbox.constants';

interface AiExtractedFields {
  customerName?: string | null;
  phone?: string | null;
  email?: string | null;
  policyNo?: string | null;
  fileNo?: string | null;
  claimNo?: string | null;
  address?: string | null;
  lossType?: string | null;
  fileSubject?: string | null;
  urgency?: 'NORMAL' | 'HIGH' | null;
  outboundReplies?: OutboundReplyAudit[];
  lastReplyAt?: string;
  lastReplyPreview?: string;
}

interface OutboundReplyAudit {
  sentAt: string;
  bodyPreview: string;
  replyAll: boolean;
  sentByUserId: string;
}

@Injectable()
export class OperationInboxService {
  private readonly logger = new Logger(OperationInboxService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly systemSettings: SystemSettingsService,
    private readonly claimFilesService: ClaimFilesService,
    private readonly customersService: CustomersService,
    private readonly emergencyCasesService: EmergencyCasesService,
    private readonly notesService: NotesService,
    @InjectQueue(INBOUND_INGEST_QUEUE) private readonly ingestQueue: Queue,
    private readonly fileMatcher: InboundFileMatcherService,
    private readonly graphMailSend: GraphMailSendService,
    private readonly routingService: InboundRoutingService,
    private readonly inboxNotifications: OperationInboxNotificationService,
    private readonly operationalAccessGrants: OperationalAccessGrantsService,
  ) {}

  async listMessages(filters: {
    mailbox?: InboundMailbox;
    status?: InboundMessageStatus;
    actionQueue?: boolean;
    limit?: number;
    offset?: number;
  }) {
    const { mailbox, status, actionQueue = true, limit = 50, offset = 0 } = filters;
    const where: Prisma.InboundMessageWhereInput = {
      ...(mailbox ? { mailbox } : {}),
      ...(status ? { status } : {}),
      ...(actionQueue ? this.buildActionQueueWhere() : {}),
    };

    const pendingWhere = this.buildActionQueueWhere();

    const [items, total, pendingCount] = await Promise.all([
      this.prisma.inboundMessage.findMany({
        where,
        orderBy: { receivedAt: 'desc' },
        take: limit,
        skip: offset,
        include: {
          attachments: { select: { id: true, fileName: true, contentType: true, sizeBytes: true } },
          assignedUser: { select: { id: true, firstName: true, lastName: true } },
          claimFile: { select: { id: true, fileNo: true } },
          emergencyCase: { select: { id: true, caseNo: true } },
        },
      }),
      this.prisma.inboundMessage.count({ where }),
      this.prisma.inboundMessage.count({ where: pendingWhere }),
    ]);

    return {
      items: items.map((item) => this.enrichMessageListItem(item)),
      total,
      pendingCount,
    };
  }

  /** Aksiyon gereken mesajlar: bağlanmamış bekleyen veya sahiplenilmiş işlenmemiş. */
  private buildActionQueueWhere(): Prisma.InboundMessageWhereInput {
    return {
      OR: [
        {
          status: { in: ['NEW', 'CLASSIFIED', 'CLASSIFYING', 'ERROR'] },
          claimFileId: null,
          emergencyCaseId: null,
        },
        {
          assignedUserId: { not: null },
          status: { not: 'ACTIONED' },
        },
      ],
    };
  }

  private enrichMessageListItem(
    item: Awaited<ReturnType<typeof this.prisma.inboundMessage.findMany>>[number] & {
      assignedUser?: { id: string; firstName: string; lastName: string } | null;
      claimFile?: { id: string; fileNo: string } | null;
      emergencyCase?: { id: string; caseNo: string } | null;
    },
  ) {
    const audit = this.parseOutboundAudit(item.aiExtractedJson);
    const routing = this.parseRouting(item.aiExtractedJson);
    return {
      ...item,
      lastReplyAt: audit.lastReplyAt,
      lastReplyPreview: audit.lastReplyPreview,
      routing,
      isUnowned: this.isUnownedItem(item),
    };
  }

  private parseRouting(json: unknown): InboundRoutingSuggestion | null {
    if (!json || typeof json !== 'object' || Array.isArray(json)) return null;
    const routing = (json as Record<string, unknown>).routing;
    if (!routing || typeof routing !== 'object' || Array.isArray(routing)) return null;
    return routing as InboundRoutingSuggestion;
  }

  private isUnownedItem(
    item: { status: InboundMessageStatus; assignedUserId?: string | null; suggestedAction?: string | null },
  ): boolean {
    if (item.assignedUserId) return false;
    if (item.status !== 'CLASSIFIED' && item.status !== 'NEW') return false;
    const action = item.suggestedAction;
    if (action === 'OPEN_HASAR_FILE' || action === 'OPEN_ACIL_FILE') return true;
    return false;
  }

  async getRoutingSuggestion(id: string) {
    await this.getMessage(id);
    return this.routingService.getRoutingSuggestion(id);
  }

  async listAssignableUsers(messageId?: string) {
    if (messageId) {
      await this.getMessage(messageId);
    }
    return this.routingService.listAssignableOfficeUsers(messageId);
  }

  async getAutoAssignPreview(id: string) {
    await this.getMessage(id);
    return this.routingService.getAutoAssignPreview(id);
  }

  async getMatchCandidates(id: string): Promise<{ candidates: FileMatchCandidate[] }> {
    const message = await this.getMessage(id);
    if (message.claimFileId || message.emergencyCaseId) {
      return { candidates: [] };
    }
    const result = await this.fileMatcher.matchMessage(message);
    return { candidates: result.candidates.slice(0, 5) };
  }

  async getMessage(id: string) {
    const message = await this.prisma.inboundMessage.findUnique({
      where: { id },
      include: {
        attachments: true,
        assignedUser: { select: { id: true, firstName: true, lastName: true } },
        claimFile: { select: { id: true, fileNo: true } },
        emergencyCase: { select: { id: true, caseNo: true } },
      },
    });
    if (!message) throw new NotFoundException('Gelen mesaj bulunamadı');
    return message;
  }

  async listByClaimFile(claimFileId: string) {
    const claim = await this.prisma.claimFile.findUnique({
      where: { id: claimFileId },
      select: { id: true },
    });
    if (!claim) throw new NotFoundException('Hasar dosyası bulunamadı');

    const items = await this.prisma.inboundMessage.findMany({
      where: { claimFileId },
      orderBy: { receivedAt: 'desc' },
      include: {
        attachments: {
          select: {
            id: true,
            fileName: true,
            contentType: true,
            sizeBytes: true,
            storageKey: true,
          },
        },
      },
    });
    return { items, total: items.length };
  }

  async listByEmergencyCase(emergencyCaseId: string) {
    const emergency = await this.prisma.emergencyCase.findUnique({
      where: { id: emergencyCaseId },
      select: { id: true },
    });
    if (!emergency) throw new NotFoundException('Acil yardım dosyası bulunamadı');

    const items = await this.prisma.inboundMessage.findMany({
      where: { emergencyCaseId },
      orderBy: { receivedAt: 'desc' },
      include: {
        attachments: {
          select: {
            id: true,
            fileName: true,
            contentType: true,
            sizeBytes: true,
            storageKey: true,
          },
        },
      },
    });
    return { items, total: items.length };
  }

  async linkClaimFile(id: string, dto: LinkClaimFileDto) {
    const message = await this.getMessage(id);
    this.assertCanLink(message);

    const claim = await this.prisma.claimFile.findUnique({
      where: { id: dto.claimFileId },
      select: { id: true, fileNo: true },
    });
    if (!claim) {
      throw new BadRequestException('Hasar dosyası bulunamadı');
    }

    const updated = await this.prisma.inboundMessage.update({
      where: { id },
      data: {
        claimFileId: claim.id,
        emergencyCaseId: null,
        status: 'ACTIONED',
        suggestedAction: null,
        processedAt: new Date(),
      },
      include: {
        claimFile: { select: { id: true, fileNo: true } },
        emergencyCase: { select: { id: true, caseNo: true } },
      },
    });

    return { claimFile: claim, message: updated };
  }

  async linkEmergencyFile(id: string, dto: LinkEmergencyFileDto) {
    const message = await this.getMessage(id);
    this.assertCanLink(message);

    const emergency = await this.prisma.emergencyCase.findUnique({
      where: { id: dto.emergencyCaseId },
      select: { id: true, caseNo: true, fileNo: true },
    });
    if (!emergency) {
      throw new BadRequestException('Acil yardım dosyası bulunamadı');
    }

    const updated = await this.prisma.inboundMessage.update({
      where: { id },
      data: {
        emergencyCaseId: emergency.id,
        claimFileId: null,
        status: 'ACTIONED',
        suggestedAction: null,
        processedAt: new Date(),
      },
      include: {
        claimFile: { select: { id: true, fileNo: true } },
        emergencyCase: { select: { id: true, caseNo: true, fileNo: true } },
      },
    });

    return { emergencyCase: emergency, message: updated };
  }

  /**
   * AI sınıflandırması beklemeden konu / zincir ipuçlarıyla dosya eşleştirmesi dener.
   */
  async attemptRuleBasedLink(messageId: string): Promise<boolean> {
    const message = await this.prisma.inboundMessage.findUnique({
      where: { id: messageId },
    });
    if (!message) return false;
    if (message.claimFileId || message.emergencyCaseId) return false;
    if (message.status === 'ACTIONED' || message.status === 'ARCHIVED') return false;
    if (message.classification === 'SPAM') return false;

    const result = await this.fileMatcher.matchMessage(message);
    const subjectHints = extractSubjectHints(message.subject);
    const isCorrespondenceReply = subjectHints.isReply || Boolean(subjectHints.claimNo);

    if (result.autoLinked) {
      await this.prisma.inboundMessage.update({
        where: { id: messageId },
        data: {
          claimFileId: result.claimFileId ?? null,
          emergencyCaseId: result.emergencyCaseId ?? null,
          status: 'ACTIONED',
          suggestedAction: null,
          processedAt: new Date(),
        },
      });
      this.logger.log(`Kural tabanlı otomatik bağlama: ${messageId}`);
      return true;
    }

    if (
      (isCorrespondenceReply || result.suggestedAction === 'LINK_EXISTING') &&
      result.candidates.length > 0
    ) {
      await this.prisma.inboundMessage.update({
        where: { id: messageId },
        data: { suggestedAction: 'LINK_EXISTING' },
      });
    }

    return false;
  }

  async reprocessMatching(limit = 200): Promise<{ processed: number; linked: number }> {
    const messages = await this.prisma.inboundMessage.findMany({
      where: {
        claimFileId: null,
        emergencyCaseId: null,
        status: { notIn: ['ACTIONED', 'ARCHIVED'] },
      },
      orderBy: { receivedAt: 'desc' },
      take: limit,
      select: { id: true },
    });

    let linked = 0;
    for (const { id } of messages) {
      const didLink = await this.attemptRuleBasedLink(id);
      if (didLink) linked += 1;
    }

    return { processed: messages.length, linked };
  }

  /**
   * Sınıflandırma sonrası otomatik dosya eşleştirmesi.
   */
  async attemptAutoLink(messageId: string, suggestedAction: string): Promise<void> {
    const message = await this.prisma.inboundMessage.findUnique({
      where: { id: messageId },
    });
    if (!message || message.status !== 'CLASSIFIED') return;
    if (!this.fileMatcher.shouldAttemptMatch(message, suggestedAction)) return;

    const result = await this.fileMatcher.matchMessage(message);
    if (result.autoLinked) {
      await this.prisma.inboundMessage.update({
        where: { id: messageId },
        data: {
          claimFileId: result.claimFileId ?? null,
          emergencyCaseId: result.emergencyCaseId ?? null,
          status: 'ACTIONED',
          suggestedAction: null,
          processedAt: new Date(),
        },
      });
      return;
    }

    if (result.suggestedAction === 'LINK_EXISTING' && message.suggestedAction !== 'LINK_EXISTING') {
      await this.prisma.inboundMessage.update({
        where: { id: messageId },
        data: { suggestedAction: 'LINK_EXISTING' },
      });
    }
  }

  async getStats() {
    const unownedWhere = {
      status: 'CLASSIFIED' as const,
      assignedUserId: null,
      suggestedAction: { in: ['OPEN_HASAR_FILE', 'OPEN_ACIL_FILE'] },
    };

    const [pending, today, actioned, unownedCount, classifiedForEscalation] = await Promise.all([
      this.prisma.inboundMessage.count({
        where: this.buildActionQueueWhere(),
      }),
      this.prisma.inboundMessage.count({
        where: {
          receivedAt: { gte: new Date(new Date().toISOString().slice(0, 10)) },
        },
      }),
      this.prisma.inboundMessage.count({
        where: { status: 'ACTIONED' },
      }),
      this.prisma.inboundMessage.count({ where: unownedWhere }),
      this.prisma.inboundMessage.findMany({
        where: unownedWhere,
        select: { aiExtractedJson: true },
        take: 500,
      }),
    ]);

    const escalatedCount = classifiedForEscalation.filter((m) => {
      const routing = this.parseRouting(m.aiExtractedJson);
      return routing?.escalated === true;
    }).length;

    return { pending, today, actioned, unownedCount, escalatedCount };
  }

  async archiveMessage(id: string) {
    await this.getMessage(id);
    return this.prisma.inboundMessage.update({
      where: { id },
      data: { status: 'ARCHIVED', processedAt: new Date() },
    });
  }

  async replyMessage(id: string, dto: ReplyMessageDto, sentByUserId?: string) {
    const message = await this.getMessage(id);
    this.assertCanReply(message);

    await this.graphMailSend.sendReply(
      message.mailbox,
      message.graphMessageId,
      dto.body.trim(),
      dto.replyAll ?? false,
    );

    const sentAt = new Date().toISOString();
    const bodyPreview = dto.body.trim().slice(0, 200);
    const aiExtractedJson = this.appendOutboundReplyAudit(message.aiExtractedJson, {
      sentAt,
      bodyPreview,
      replyAll: dto.replyAll ?? false,
      sentByUserId: sentByUserId ?? 'unknown',
    });

    const updated = await this.prisma.inboundMessage.update({
      where: { id },
      data: {
        status: 'ACTIONED',
        suggestedAction: message.suggestedAction === 'REPLY_ONLY' ? null : message.suggestedAction,
        processedAt: new Date(),
        aiExtractedJson,
      },
      include: {
        attachments: { select: { id: true, fileName: true, contentType: true, sizeBytes: true } },
        assignedUser: { select: { id: true, firstName: true, lastName: true } },
        claimFile: { select: { id: true, fileNo: true } },
        emergencyCase: { select: { id: true, caseNo: true } },
      },
    });

    return {
      sent: true,
      message: this.enrichMessageListItem(updated),
    };
  }

  async composeMessage(dto: ComposeMessageDto, sentByUserId: string) {
    if (dto.claimFileId && dto.emergencyCaseId) {
      throw new BadRequestException('Yalnızca hasar veya acil dosyasından biri seçilebilir');
    }

    if (dto.claimFileId) {
      const claim = await this.prisma.claimFile.findUnique({
        where: { id: dto.claimFileId },
        select: { id: true },
      });
      if (!claim) throw new BadRequestException('Hasar dosyası bulunamadı');
    }

    if (dto.emergencyCaseId) {
      const emergency = await this.prisma.emergencyCase.findUnique({
        where: { id: dto.emergencyCaseId },
        select: { id: true },
      });
      if (!emergency) throw new BadRequestException('Acil yardım dosyası bulunamadı');
    }

    await this.graphMailSend.sendMail(
      dto.mailbox,
      dto.to,
      dto.subject,
      dto.body,
    );

    if (dto.claimFileId) {
      await this.notesService.create(
        {
          claimFileId: dto.claimFileId,
          content: `Gelen kutusundan gönderilen e-posta — Konu: ${dto.subject.trim()}`,
          noteType: 'general',
        },
        sentByUserId,
      );
    }

    if (dto.emergencyCaseId) {
      const emergency = await this.prisma.emergencyCase.findUnique({
        where: { id: dto.emergencyCaseId },
        select: { notes: true },
      });
      if (emergency) {
        const prefix = emergency.notes?.trim() ? `${emergency.notes.trim()}\n\n` : '';
        await this.prisma.emergencyCase.update({
          where: { id: dto.emergencyCaseId },
          data: {
            notes: `${prefix}Gelen kutusundan gönderilen e-posta — Konu: ${dto.subject.trim()}`,
          },
        });
      }
    }

    return {
      sent: true,
      mailbox: dto.mailbox,
      to: dto.to,
      subject: dto.subject.trim(),
    };
  }

  async assignMessage(id: string, dto: AssignMessageDto) {
    const message = await this.getMessage(id);
    const user = await this.prisma.user.findUnique({
      where: { id: dto.assignedUserId },
      select: { id: true, firstName: true, lastName: true, email: true },
    });
    if (!user) {
      throw new BadRequestException('Atanacak kullanıcı bulunamadı');
    }

    const updated = await this.prisma.inboundMessage.update({
      where: { id },
      data: { assignedUserId: dto.assignedUserId },
      include: {
        assignedUser: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    if (message.assignedUserId !== dto.assignedUserId) {
      const mailboxLabel = message.mailbox === 'IHBAR' ? 'İhbar' : 'Hasar';
      void this.inboxNotifications.notifyAssigned({
        userId: user.id,
        userEmail: user.email,
        messageId: message.id,
        subject: message.subject,
        mailboxLabel,
      });
    }

    return updated;
  }

  async openClaimFile(id: string, dto: OpenClaimFileDto, userId: string) {
    const message = await this.getMessage(id);
    this.assertCanOpenClaim(message);

    const extracted = this.enrichExtracted(message, this.parseExtracted(message.aiExtractedJson));
    const customerId = await this.resolveCustomerForOpen(
      dto,
      extracted,
      message.fromName,
      message.fromAddress,
    );
    const insuredName = this.resolveInsuredName(dto.insuredName, extracted, message.fromName, message.fromAddress);
    const insuredPhone = dto.insuredPhone?.trim() || extracted.phone?.trim() || undefined;
    const fileNo = await this.resolveUniqueFileNo(
      dto.fileNo?.trim() || extracted.fileNo,
      () => this.generateClaimFileNo(),
    );
    const insuranceCompanyId = await this.resolveInsuranceCompanyId(
      dto.insuranceCompanyId,
    );
    const receivedAt = message.receivedAt ?? new Date();
    const policyNo = dto.policyNo?.trim() || extracted.policyNo?.trim() || 'Belirtilmedi';
    const lossType =
      dto.lossType?.trim()
      || extracted.lossType?.trim()
      || mapInboundCategoryToMeridyen(dto.fileSubject?.trim() || extracted.fileSubject)
      || 'Belirtilmemiş';
    const claimNo =
      dto.claimNo?.trim()
      || extracted.claimNo?.trim()
      || fileNo;
    const description = [
      `Gelen kutusu ihbarı: ${message.subject}`,
      message.aiSummary,
    ]
      .filter(Boolean)
      .join('\n');

    const assigneeId = dto.assignedUserId ?? message.assignedUserId ?? undefined;
    const routing = this.parseRouting(message.aiExtractedJson);
    const officeAssignee =
      routing?.suggestedAssigneeRole === 'field' ? undefined : (assigneeId ?? routing?.suggestedAssigneeId ?? undefined);
    const fieldAssignee =
      routing?.suggestedAssigneeRole === 'field' ? (assigneeId ?? routing?.suggestedAssigneeId ?? undefined) : undefined;

    const claimPayload: Record<string, unknown> = {
      fileNo,
      insuranceCompanyId,
      policyNo,
      claimNo,
      productBranch: 'diger',
      lossType,
      incidentDate: receivedAt.toISOString(),
      notificationDate: receivedAt.toISOString(),
      priority: extracted.urgency === 'HIGH' ? 'high' : 'normal',
      sourceChannel: 'email_inbox',
      description,
      insuredName,
      insuredPhone,
    };

    if (customerId) {
      claimPayload.customerId = customerId;
    }

    if (dto.insuredAddress?.trim() || extracted.address?.trim()) {
      claimPayload.propertyAddress = dto.insuredAddress?.trim() || extracted.address!.trim();
    }

    if (officeAssignee) {
      claimPayload.assignedOfficeUserId = officeAssignee;
    }
    if (fieldAssignee) {
      claimPayload.assignedFieldUserId = fieldAssignee;
    }

    const claimFile = await this.claimFilesService.create(claimPayload);

    await this.notesService.create(
      {
        claimFileId: claimFile.id,
        content: dto.instruction.trim(),
        noteType: 'manager_instruction',
      },
      userId,
    );

    const finalAssigneeId = officeAssignee ?? fieldAssignee;
    const updated = await this.prisma.inboundMessage.update({
      where: { id },
      data: {
        status: 'ACTIONED',
        claimFileId: claimFile.id,
        managerInstruction: dto.instruction.trim(),
        assignedUserId: finalAssigneeId ?? message.assignedUserId,
        processedAt: new Date(),
      },
      include: {
        claimFile: { select: { id: true, fileNo: true } },
        emergencyCase: { select: { id: true, caseNo: true } },
      },
    });

    if (finalAssigneeId) {
      const assignee = await this.prisma.user.findUnique({
        where: { id: finalAssigneeId },
        select: { id: true, email: true },
      });
      if (assignee) {
        void this.inboxNotifications.notifyNewIhbarFromInbox({
          userId: assignee.id,
          userEmail: assignee.email,
          messageId: message.id,
          subject: message.subject,
          fileNo: claimFile.fileNo,
          fileType: 'hasar',
          fileId: claimFile.id,
        });
      }
    }

    return {
      claimFile: { id: claimFile.id, fileNo: claimFile.fileNo },
      message: updated,
    };
  }

  async openEmergencyFile(id: string, dto: OpenEmergencyFileDto, userId: string) {
    const message = await this.getMessage(id);
    this.assertCanOpenEmergency(message);

    const assistantCustomerId = dto.assistantCustomerId?.trim();
    if (!assistantCustomerId) {
      throw new BadRequestException('Asistan firması seçilmelidir');
    }
    const assistantCustomer = await this.prisma.customer.findFirst({
      where: {
        id: assistantCustomerId,
        entityType: 'corporate',
        subType: 'asistan_firmasi',
        status: 'active',
      },
      select: { id: true, companyName: true, fullName: true },
    });
    if (!assistantCustomer) {
      throw new BadRequestException('Geçersiz asistan firması seçildi');
    }

    const extracted = this.enrichExtracted(message, this.parseExtracted(message.aiExtractedJson));
    const fileNo = await this.resolveUniqueFileNo(
      dto.fileNo?.trim() || extracted.fileNo,
      () => this.generateEmergencyFileNo(),
    );
    const customerName =
      this.resolveInsuredName(dto.insuredName, extracted, message.fromName, message.fromAddress)
      || 'Belirtilmemiş';
    const customerPhone = dto.insuredPhone?.trim() || extracted.phone?.trim() || undefined;
    const address = dto.insuredAddress?.trim() || extracted.address?.trim() || 'Belirtilmemiş';
    const issueType =
      mapInboundCategoryToMeridyen(dto.fileSubject?.trim() || extracted.fileSubject)
      || mapInboundLossTypeToMeridyen(dto.lossType?.trim() || extracted.lossType)
      || 'Gelen Kutu İhbarı';
    const urgency: EmergencyUrgency =
      extracted.urgency === 'HIGH' ? 'YUKSEK' : 'NORMAL';
    const instructionBlock = dto.instruction.trim();
    const assistantLabel = assistantCustomer.companyName ?? assistantCustomer.fullName ?? 'Asistan Firması';
    const notes = [
      `Gelen kutusu ihbarı: ${message.subject}`,
      message.aiSummary,
      `Asistan firması: ${assistantLabel}`,
      `Talimat: ${instructionBlock}`,
    ]
      .filter(Boolean)
      .join('\n');

    const routing = this.parseRouting(message.aiExtractedJson);
    const assigneeId =
      dto.assignedUserId ?? message.assignedUserId ?? routing?.suggestedAssigneeId ?? undefined;

    if (assigneeId) {
      await this.assertAssigneeCoversAssistantCustomer(assigneeId, assistantCustomerId);
    }

    const { data: emergencyCase } = await this.emergencyCasesService.create(
      {
        customerName,
        customerPhone,
        customerId: assistantCustomerId,
        fileNo,
        address,
        issueType,
        urgency,
        fileDate: (message.receivedAt ?? new Date()).toISOString(),
        assignedUserId: assigneeId,
        assignedVendorId: dto.assignedVendorId,
        notes,
      },
      userId,
    );

    const updated = await this.prisma.inboundMessage.update({
      where: { id },
      data: {
        status: 'ACTIONED',
        emergencyCaseId: emergencyCase.id,
        managerInstruction: instructionBlock,
        assignedUserId: assigneeId ?? message.assignedUserId,
        processedAt: new Date(),
      },
      include: {
        claimFile: { select: { id: true, fileNo: true } },
        emergencyCase: { select: { id: true, caseNo: true, fileNo: true } },
      },
    });

    if (assigneeId) {
      const assignee = await this.prisma.user.findUnique({
        where: { id: assigneeId },
        select: { id: true, email: true },
      });
      if (assignee) {
        void this.inboxNotifications.notifyNewIhbarFromInbox({
          userId: assignee.id,
          userEmail: assignee.email,
          messageId: message.id,
          subject: message.subject,
          fileNo: emergencyCase.fileNo ?? emergencyCase.caseNo,
          fileType: 'acil',
          fileId: emergencyCase.id,
        });
      }
    }

    return {
      emergencyCase: {
        id: emergencyCase.id,
        caseNo: emergencyCase.caseNo,
        fileNo: emergencyCase.fileNo,
      },
      message: updated,
    };
  }

  private async assertAssigneeCoversAssistantCustomer(
    userId: string,
    assistantCustomerId: string,
  ): Promise<void> {
    const hasFunctionDelegation = await this.operationalAccessGrants.hasFunctionDelegation(
      userId,
      'acil_yardim',
    );
    if (hasFunctionDelegation) return;

    const ACIL_DEPT_CODES = new Set(['acil-yardim', 'ACIL_YARDIM', 'acil', 'ACIL']);
    const assignments = await this.prisma.claimResponsibilityAssignment.findMany({
      where: { userId, isActive: true },
      include: { department: { select: { code: true } } },
    });
    const acilAssignments = assignments.filter(
      (item) => item.department?.code && ACIL_DEPT_CODES.has(item.department.code),
    );
    if (acilAssignments.length === 0) return;

    const coversAll = acilAssignments.some((item) => item.coverageType === 'all');
    if (coversAll) return;

    const allowedIds = new Set<string>();
    for (const item of acilAssignments) {
      const cfg = item.coverageConfig as { customerIds?: string[] } | null;
      for (const id of cfg?.customerIds ?? []) {
        if (id) allowedIds.add(id);
      }
    }
    if (allowedIds.size > 0 && !allowedIds.has(assistantCustomerId)) {
      throw new BadRequestException(
        'Seçilen dosya sorumlusu bu asistan firması kapsamında değil. Sorumlu veya asistan firmasını güncelleyin.',
      );
    }
  }

  private async resolveCustomerForOpen(
    dto: OpenClaimFileDto | OpenEmergencyFileDto,
    extracted: AiExtractedFields,
    fromName: string | null,
    fromAddress: string,
  ): Promise<string | undefined> {
    if (dto.customerId?.trim()) {
      await this.customersService.findOne(dto.customerId.trim());
      return dto.customerId.trim();
    }

    if (dto.createCustomer) {
      return this.createCustomerFromInbox(dto.createCustomer, extracted, fromName, fromAddress);
    }

    return undefined;
  }

  private async createCustomerFromInbox(
    input: CreateCustomerFromInboxDto,
    extracted: AiExtractedFields,
    fromName: string | null,
    fromAddress: string,
  ): Promise<string> {
    const phone = input.phone?.trim() || extracted.phone?.trim() || undefined;
    let email = resolveInsuredEmailForInbox({
      explicitEmail: input.email,
      extractedEmail: extracted.email,
      fromAddress,
    });

    const runDuplicateCheck = () =>
      this.customersService.checkDuplicate({
        phone,
        email,
        firstName: input.firstName,
        lastName: input.lastName,
      });

    let dup = await runDuplicateCheck();

    if (
      dup.exists
      && shouldCreateInsuredWithoutEmailOnDuplicate({
        field: dup.field,
        entityType: dup.existingRecord?.entityType,
        creatingEntityType: input.entityType,
      })
    ) {
      email = undefined;
      dup = await runDuplicateCheck();
    }

    if (dup.exists) {
      const fieldLabels: Record<string, string> = {
        phone: 'Telefon',
        email: 'E-posta',
        tc: 'TC Kimlik No',
      };
      const label = fieldLabels[dup.field ?? ''] ?? 'Bilgi';
      const name = dup.existingRecord?.fullName ?? 'mevcut kayıt';
      if (dup.existingRecord?.type === 'customer') {
        throw new BadRequestException(
          `Bu ${label} ile kayıtlı müşteri zaten var: ${name}. Mevcut müşteriyi seçin veya farklı bilgi girin.`,
        );
      }
      throw new BadRequestException(
        `Bu ${label} başka bir kayıtta kullanılıyor. Lütfen farklı bilgi girin.`,
      );
    }

    if (input.entityType === 'individual') {
      const insuredFull =
        [input.firstName, input.lastName].filter(Boolean).join(' ').trim()
        || extracted.customerName?.trim()
        || '';
      const split = insuredFull
        ? splitPersonName(insuredFull)
        : !isCorporateInboxSender(fromAddress) && fromName?.trim()
          ? splitPersonName(fromName.trim())
          : { firstName: '', lastName: '' };
      const firstName = input.firstName?.trim() || split.firstName || 'Belirtilmemiş';
      const lastName = input.lastName?.trim() || split.lastName || 'Belirtilmemiş';
      const customer = await this.customersService.create({
        entityType: 'individual',
        firstName,
        lastName,
        phone,
        email,
        notes:
          input.address?.trim()
          || extracted.address?.trim()
          || undefined,
        status: 'active',
      });
      return customer.id;
    }

    const companyName =
      input.companyName?.trim() ||
      extracted.customerName?.trim() ||
      fromName?.trim() ||
      'Belirtilmemiş';
    const customer = await this.customersService.create({
      entityType: 'corporate',
      companyName,
      phone,
      email,
      status: 'active',
    });
    return customer.id;
  }

  private enrichExtracted(message: InboundMessage, extracted: AiExtractedFields): AiExtractedFields {
    const heuristic = extractHeuristicFields(message);
    const bodyTextForPhone = [
      message.bodyText,
      message.bodyPreview,
      message.bodyHtml,
    ].filter(Boolean).join('\n');
    const phone =
      resolveInsuredPhoneForInbox({
        heuristicPhone: heuristic.phone,
        extractedPhone: extracted.phone,
        bodyText: bodyTextForPhone,
      }) ?? null;
    const address = heuristic.address?.trim() || extracted.address?.trim() || null;
    return {
      ...extracted,
      customerName: extracted.customerName?.trim() || heuristic.customerName || null,
      phone,
      policyNo: extracted.policyNo?.trim() || heuristic.policyNo || null,
      fileNo: extracted.fileNo?.trim() || heuristic.fileNo || null,
      claimNo: extracted.claimNo?.trim() || heuristic.claimNo || null,
      address,
      lossType: extracted.lossType?.trim() || heuristic.lossType || null,
      fileSubject: extracted.fileSubject?.trim() || heuristic.fileSubject || null,
    };
  }

  private resolveInsuredName(
    explicit: string | undefined,
    extracted: AiExtractedFields,
    fromName: string | null,
    fromAddress: string,
  ): string | undefined {
    const named = explicit?.trim() || extracted.customerName?.trim();
    if (named) return named;
    if (isCorporateInboxSender(fromAddress)) return undefined;
    return fromName?.trim() || undefined;
  }

  private parseExtracted(json: unknown): AiExtractedFields {
    if (!json || typeof json !== 'object' || Array.isArray(json)) {
      return {};
    }
    const raw = json as Record<string, unknown>;
    return {
      customerName: typeof raw.customerName === 'string' ? raw.customerName : null,
      phone: typeof raw.phone === 'string' ? raw.phone : null,
      email: typeof raw.email === 'string' ? raw.email : null,
      policyNo: typeof raw.policyNo === 'string' ? raw.policyNo : null,
      fileNo: typeof raw.fileNo === 'string' ? raw.fileNo : null,
      claimNo: typeof raw.claimNo === 'string' ? raw.claimNo : null,
      address: typeof raw.address === 'string' ? raw.address : null,
      lossType: typeof raw.lossType === 'string' ? raw.lossType : null,
      fileSubject: typeof raw.fileSubject === 'string' ? raw.fileSubject : null,
      urgency:
        raw.urgency === 'HIGH' || raw.urgency === 'NORMAL' ? raw.urgency : null,
    };
  }

  private assertCanReply(message: InboundMessage) {
    if (message.status === 'ARCHIVED') {
      throw new BadRequestException('Arşivlenmiş mesaja yanıt verilemez');
    }
    if (message.status === 'CLASSIFYING') {
      throw new BadRequestException('Sınıflandırma tamamlanmadan yanıt verilemez');
    }
    if (!message.graphMessageId?.trim()) {
      throw new BadRequestException('Mesajın Graph kimliği bulunamadı');
    }
  }

  private assertCanLink(message: InboundMessage) {
    if (message.claimFileId || message.emergencyCaseId) {
      throw new BadRequestException('Bu mesaj zaten bir dosyaya bağlı');
    }
    if (message.status === 'ARCHIVED') {
      throw new BadRequestException('Arşivlenmiş mesaj bağlanamaz');
    }
    if (message.status === 'CLASSIFYING') {
      throw new BadRequestException('Sınıflandırma tamamlanmadan bağlanamaz');
    }
  }

  private assertCanOpenClaim(message: InboundMessage) {
    if (message.claimFileId) {
      throw new BadRequestException('Bu mesaj zaten bir hasar dosyasına bağlı');
    }
    if (message.status === 'ARCHIVED') {
      throw new BadRequestException('Arşivlenmiş mesajdan dosya açılamaz');
    }
    if (message.status === 'CLASSIFYING') {
      throw new BadRequestException('Sınıflandırma tamamlanmadan dosya açılamaz');
    }
  }

  private assertCanOpenEmergency(message: InboundMessage) {
    if (message.emergencyCaseId) {
      throw new BadRequestException('Bu mesaj zaten bir acil yardım dosyasına bağlı');
    }
    if (message.status === 'ARCHIVED') {
      throw new BadRequestException('Arşivlenmiş mesajdan dosya açılamaz');
    }
    if (message.status === 'CLASSIFYING') {
      throw new BadRequestException('Sınıflandırma tamamlanmadan dosya açılamaz');
    }
  }

  private async resolveInsuranceCompanyId(explicit?: string): Promise<string> {
    if (explicit?.trim()) {
      const company = await this.prisma.insuranceCompany.findUnique({
        where: { id: explicit.trim() },
        select: { id: true, status: true },
      });
      if (!company || company.status !== 'active') {
        throw new BadRequestException('Seçilen sigorta şirketi bulunamadı veya aktif değil');
      }
      return company.id;
    }

    const activeCompanies = await this.prisma.insuranceCompany.findMany({
      where: { status: 'active' },
      orderBy: { name: 'asc' },
      select: { id: true },
    });

    if (activeCompanies.length === 0) {
      throw new BadRequestException(
        'Sigorta şirketi tanımlı değil. Önce sigorta şirketi ekleyin.',
      );
    }

    if (activeCompanies.length === 1) {
      return activeCompanies[0].id;
    }

    throw new BadRequestException(
      'Hasar dosyası açmak için sigorta şirketi seçimi zorunludur.',
    );
  }

  private parseOutboundAudit(json: unknown): { lastReplyAt?: string; lastReplyPreview?: string } {
    if (!json || typeof json !== 'object' || Array.isArray(json)) return {};
    const raw = json as Record<string, unknown>;
    return {
      lastReplyAt: typeof raw.lastReplyAt === 'string' ? raw.lastReplyAt : undefined,
      lastReplyPreview: typeof raw.lastReplyPreview === 'string' ? raw.lastReplyPreview : undefined,
    };
  }

  private appendOutboundReplyAudit(
    existingJson: unknown,
    entry: OutboundReplyAudit,
  ): Prisma.InputJsonValue {
    const base =
      existingJson && typeof existingJson === 'object' && !Array.isArray(existingJson)
        ? { ...(existingJson as Record<string, unknown>) }
        : {};
    const replies = Array.isArray(base.outboundReplies)
      ? [...(base.outboundReplies as OutboundReplyAudit[])]
      : [];
    replies.push(entry);
    base.outboundReplies = replies.slice(-20);
    base.lastReplyAt = entry.sentAt;
    base.lastReplyPreview = entry.bodyPreview;
    return base as Prisma.InputJsonValue;
  }

  private async resolveUniqueFileNo(
    preferred: string | null | undefined,
    generator: () => Promise<string>,
  ): Promise<string> {
    if (preferred?.trim()) {
      const trimmed = preferred.trim();
      const [claimExists, emergencyExists] = await Promise.all([
        this.prisma.claimFile.findUnique({ where: { fileNo: trimmed }, select: { id: true } }),
        this.prisma.emergencyCase.findFirst({ where: { fileNo: trimmed }, select: { id: true } }),
      ]);
      if (!claimExists && !emergencyExists) {
        return trimmed;
      }
    }
    return generator();
  }

  private async generateClaimFileNo(): Promise<string> {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const prefix = `HK-${year}${month}-`;
    const latest = await this.prisma.claimFile.findFirst({
      where: { fileNo: { startsWith: prefix } },
      orderBy: { fileNo: 'desc' },
      select: { fileNo: true },
    });
    const seq = latest ? parseInt(latest.fileNo.replace(prefix, ''), 10) + 1 : 1;
    return `${prefix}${String(seq).padStart(4, '0')}`;
  }

  private async generateEmergencyFileNo(): Promise<string> {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const prefix = `AYF-${year}${month}-`;
    const latest = await this.prisma.emergencyCase.findFirst({
      where: { fileNo: { startsWith: prefix } },
      orderBy: { fileNo: 'desc' },
      select: { fileNo: true },
    });
    const seq = latest?.fileNo
      ? parseInt(latest.fileNo.replace(prefix, ''), 10) + 1
      : 1;
    return `${prefix}${String(seq).padStart(4, '0')}`;
  }

  /**
   * Her iki paylaşımlı kutu için Graph delta sync job’larını kuyruğa alır.
   * İlk çalıştırma: son 30 gün; devam: graph_subscriptions.delta_link.
   */
  async triggerSync(opts?: { scheduled?: boolean }) {
    const config = await this.systemSettings.getM365GraphConfig();

    if (!config.active) {
      const message = 'Microsoft 365 entegrasyonu etkin değil. Ayarlar → Entegrasyonlar’dan etkinleştirin.';
      if (opts?.scheduled) {
        this.logger.debug(message);
        return { ok: false, message };
      }
      return { ok: false, message };
    }

    if (!config.tenantId?.trim() || !config.clientId?.trim() || !config.clientSecret?.trim()) {
      const message =
        'Microsoft 365 kimlik bilgileri eksik. Kiracı kimliği, uygulama kimliği ve gizli anahtar gerekli.';
      return { ok: false, message };
    }

    const mailboxes: InboundMailbox[] = ['IHBAR', 'HASAR'];
    const jobIds: string[] = [];

    for (const mailbox of mailboxes) {
      const job = await this.ingestQueue.add(
        INGEST_JOB_SYNC_MAILBOX,
        { mailbox },
        SYNC_JOB_OPTIONS,
      );
      jobIds.push(String(job.id));
    }

    this.logger.log(`Graph delta sync kuyruğa alındı: ${mailboxes.join(', ')}`);

    return {
      ok: true,
      message: 'Senkronizasyon başlatıldı. Mesajlar arka planda işlenecek.',
      mailboxes,
      jobIds,
    };
  }
}
