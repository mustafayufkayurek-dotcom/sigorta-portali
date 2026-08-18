import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { VendorCostMemoryService } from '@/modules/vendor-cost-memory/vendor-cost-memory.service';
import { compareVendorQuote } from '@/modules/vendor-cost-memory/vendor-cost-quote.helper';
import { VendorRecommendationService } from '@/modules/vendors/vendor-recommendation.service';
import {
  aggregateTerminologyMemory,
  buildExpertiseHints,
  emptyTerminologyMemory,
  resolveOperationGroupLabel,
  resolveTerminology,
  type TerminologyResolution,
} from './terminology-memory.helper';
import type {
  VendorFileCompletedContext,
  VendorHakedisHookContext,
  VendorHookResult,
  VendorIntelligenceProfile,
  VendorIntelligenceProfileConstraints,
  VendorPaymentHookContext,
  VendorQuoteCompareResult,
  VendorRecommendQuery,
  VendorRecommendationItem,
  VendorWhatsappRef,
} from './vendor-intelligence-profile.types';

const HAKEDIS_BLOCKER =
  'Hakediş otomasyonu mevcut hasar hakediş servisinde claimFileId bağı gerektiriyor; acil dosya için blocker.';
const PAYMENT_BLOCKER =
  'Ödeme/cari otomasyonu mevcut ödeme zincirinde claimFileId bağı gerektiriyor; acil dosya için blocker.';

@Injectable()
export class VendorIntelligenceProfileService {
  private readonly logger = new Logger(VendorIntelligenceProfileService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly recommendation: VendorRecommendationService,
    private readonly costMemory: VendorCostMemoryService,
  ) {}

  async getProfile(
    vendorId: string,
    context?: {
      workGroupId?: string;
      serviceType?: string;
      category?: string;
      city?: string;
      district?: string;
      months?: number;
    },
  ): Promise<VendorIntelligenceProfile> {
    const vendor = await this.prisma.vendor.findUnique({
      where: { id: vendorId },
      select: { id: true, name: true },
    });
    if (!vendor) throw new NotFoundException('Tedarikçi bulunamadı.');

    const serviceType = context?.serviceType ?? context?.category;
    const [operationMemory, costMemory, whatsappRefs, terminologyMemory] = await Promise.all([
      this.recommendation.getOperationMetrics(vendorId, serviceType),
      this.costMemory.getVendorSummary({
        vendorId,
        workGroupId: context?.workGroupId,
        serviceType,
        city: context?.city,
        district: context?.district,
        months: context?.months ?? 12,
      }),
      this.loadWhatsappRefs(vendorId),
      this.loadTerminologyMemory(vendorId, serviceType),
    ]);

    const decisionOpts = {
      costMemoryLinked: Boolean(costMemory && costMemory.count > 0),
      recommendationLinked: true,
    };
    if (terminologyMemory.decisionEngine) {
      terminologyMemory.decisionEngine = {
        ...terminologyMemory.decisionEngine,
        chain: {
          ...terminologyMemory.decisionEngine.chain,
          costMemoryReady:
            Boolean(terminologyMemory.decisionEngine.operationGroup)
            && decisionOpts.costMemoryLinked,
          recommendationReady: Boolean(terminologyMemory.decisionEngine.operationGroup),
        },
      };
    }

    return {
      vendorId: vendor.id,
      vendorName: vendor.name,
      operationMemory,
      costMemory,
      terminologyMemory,
      whatsappRefs,
      constraints: this.buildConstraints(),
    };
  }

  async recommend(query: VendorRecommendQuery): Promise<VendorRecommendationItem[]> {
    return this.recommendation.recommend(query);
  }

  async recommendForClaimFile(fileId: string, limit = 3): Promise<VendorRecommendationItem[]> {
    return this.recommendation.recommendForClaimFile(fileId, limit);
  }

  async recommendForEmergencyCase(caseId: string, limit = 20): Promise<VendorRecommendationItem[]> {
    return this.recommendation.recommendForEmergencyCase(caseId, limit);
  }

  async compareQuote(params: {
    vendorId: string;
    quoteAmount: number;
    workGroupId?: string;
    serviceType?: string;
    category?: string;
    city?: string;
    district?: string;
  }): Promise<VendorQuoteCompareResult> {
    const summary = await this.costMemory.getVendorSummary({
      vendorId: params.vendorId,
      workGroupId: params.workGroupId,
      serviceType: params.serviceType ?? params.category,
      city: params.city,
      district: params.district,
    });
    const comparison = compareVendorQuote(params.quoteAmount, summary?.avgCost ?? 0);
    return { summary, comparison };
  }

  /** Dosya kapanışı — operasyon hafızası + maliyet hafızası + WhatsApp referans havuzu güncellenir. */
  async onFileCompleted(context: VendorFileCompletedContext): Promise<void> {
    if (context.type === 'claim_file') {
      await this.recommendation.onClaimFileClosed(context.id);
      return;
    }
    await this.recommendation.onEmergencyCaseResolved(context.id);
  }

  /** Hakediş hook — claimFileId yoksa profil constraints ile işaretlenir; sahte otomasyon yok. */
  async onHakedisCreated(context: VendorHakedisHookContext): Promise<VendorHookResult> {
    if (!context.claimFileId) {
      this.logger.debug(
        `[profile] onHakedisCreated atlandı — vendor=${context.vendorId} claimFileId yok`,
      );
      return { updated: false, reason: HAKEDIS_BLOCKER };
    }
    this.logger.log(
      `[profile] Hakediş kaydı profil referansına bağlandı — vendor=${context.vendorId} claimFile=${context.claimFileId}`,
    );
    return { updated: true };
  }

  /** Ödeme/cari hook — claimFileId blocker açıkça işaretlenir. */
  async onPaymentRecorded(context: VendorPaymentHookContext): Promise<VendorHookResult> {
    if (!context.claimFileId) {
      this.logger.debug(
        `[profile] onPaymentRecorded atlandı — vendor=${context.vendorId} claimFileId yok`,
      );
      return { updated: false, reason: PAYMENT_BLOCKER };
    }
    this.logger.log(
      `[profile] Ödeme kaydı profil referansına bağlandı — vendor=${context.vendorId} claimFile=${context.claimFileId}`,
    );
    return { updated: true };
  }

  private buildConstraints(): VendorIntelligenceProfileConstraints {
    return {
      hakedisAutomation: 'blocked',
      paymentAutomation: 'blocked',
      vendorStatementRequiresClaimFile: true,
      paymentRequiresClaimFile: true,
      reasons: [HAKEDIS_BLOCKER, PAYMENT_BLOCKER],
    };
  }

  /** Okuma-zamanı terminoloji hafızası — orijinal metin korunur, kanonik etiket türetilir. */
  private async loadTerminologyMemory(
    vendorId: string,
    queryServiceType?: string,
  ) {
    const query = queryServiceType?.trim()
      ? await resolveTerminology(this.prisma, queryServiceType)
      : null;

    const [claimLinks, assignedFiles, emergencyCases] = await Promise.all([
      this.prisma.claimFileSupplier.findMany({
        where: {
          vendorId,
          claimFile: { currentStatus: { isClosedState: true } },
        },
        select: {
          claimFile: {
            select: {
              lossType: true,
              claimSubject: { select: { id: true, name: true } },
            },
          },
        },
        take: 80,
        orderBy: { assignedAt: 'desc' },
      }),
      this.prisma.claimFile.findMany({
        where: {
          assignedSupplierId: vendorId,
          currentStatus: { isClosedState: true },
        },
        select: {
          lossType: true,
          claimSubject: { select: { id: true, name: true } },
        },
        take: 40,
        orderBy: { closedAt: 'desc' },
      }),
      this.prisma.emergencyCase.findMany({
        where: {
          assignedVendorId: vendorId,
          status: { in: ['COZULDU', 'FATURALANDILDI'] },
        },
        select: { issueType: true },
        take: 40,
        orderBy: { resolvedAt: 'desc' },
      }),
    ]);

    const resolutions: TerminologyResolution[] = [];
    const pendingTexts: string[] = [];

    const pushClaim = (row: {
      lossType: string | null;
      claimSubject: { id: string; name: string } | null;
    }) => {
      if (row.claimSubject) {
        const operationGroup = resolveOperationGroupLabel(
          row.claimSubject.name,
          row.lossType,
        );
        resolutions.push({
          originalText: row.lossType?.trim() || row.claimSubject.name,
          canonicalSubjectId: row.claimSubject.id,
          canonicalLabel: row.claimSubject.name,
          operationGroup,
          expertiseHints: buildExpertiseHints(operationGroup, [
            row.claimSubject.name,
            row.lossType,
          ]),
          matched: true,
          source: 'claim_subject',
        });
        return;
      }
      if (row.lossType?.trim()) pendingTexts.push(row.lossType.trim());
    };

    for (const link of claimLinks) {
      if (link.claimFile) pushClaim(link.claimFile);
    }
    for (const file of assignedFiles) pushClaim(file);
    for (const ec of emergencyCases) {
      if (ec.issueType?.trim()) pendingTexts.push(ec.issueType.trim());
    }

    const uniqueTexts = [...new Set(pendingTexts)];
    const resolvedMap = new Map<string, TerminologyResolution>();
    await Promise.all(
      uniqueTexts.map(async (text) => {
        resolvedMap.set(text, await resolveTerminology(this.prisma, text));
      }),
    );
    for (const text of pendingTexts) {
      const r = resolvedMap.get(text);
      if (r) resolutions.push(r);
    }

    if (!resolutions.length) return emptyTerminologyMemory(query);
    return aggregateTerminologyMemory(resolutions, query);
  }

  private async loadWhatsappRefs(vendorId: string, limit = 12): Promise<VendorWhatsappRef[]> {
    const [assignedFiles, supplierLinks] = await Promise.all([
      this.prisma.claimFile.findMany({
        where: { assignedSupplierId: vendorId },
        select: { id: true, fileNo: true },
        take: 40,
        orderBy: { updatedAt: 'desc' },
      }),
      this.prisma.claimFileSupplier.findMany({
        where: { vendorId },
        select: { claimFileId: true, claimFile: { select: { fileNo: true } } },
        take: 40,
        orderBy: { assignedAt: 'desc' },
      }),
    ]);

    const fileMeta = new Map<string, string>();
    for (const file of assignedFiles) fileMeta.set(file.id, file.fileNo);
    for (const link of supplierLinks) {
      if (link.claimFile?.fileNo) fileMeta.set(link.claimFileId, link.claimFile.fileNo);
    }
    const claimFileIds = [...fileMeta.keys()];
    if (!claimFileIds.length) return [];

    const [archives, documents] = await Promise.all([
      this.prisma.chatArchive.findMany({
        where: { claimFileId: { in: claimFileIds } },
        orderBy: { uploadedAt: 'desc' },
        take: limit,
        select: {
          id: true,
          claimFileId: true,
          label: true,
          uploadedAt: true,
          parsedMessages: true,
        },
      }),
      this.prisma.fileDocument.findMany({
        where: {
          entityType: 'claim_file',
          entityId: { in: claimFileIds },
          whatsappSentAt: { not: null },
        },
        orderBy: { whatsappSentAt: 'desc' },
        take: limit,
        select: {
          id: true,
          entityId: true,
          documentKind: true,
          whatsappSentAt: true,
          whatsappPhone: true,
        },
      }),
    ]);

    const refs: VendorWhatsappRef[] = [];

    for (const archive of archives) {
      const messageCount = Array.isArray(archive.parsedMessages)
        ? (archive.parsedMessages as unknown[]).length
        : 0;
      const fileNo = fileMeta.get(archive.claimFileId);
      refs.push({
        source: 'chat_archive',
        id: archive.id,
        claimFileId: archive.claimFileId,
        label: archive.label || (fileNo ? `Dosya ${fileNo} Sohbet Arşivi` : 'Sohbet Arşivi'),
        sentAt: archive.uploadedAt.toISOString(),
        messageCount,
      });
    }

    for (const doc of documents) {
      const fileNo = fileMeta.get(doc.entityId);
      refs.push({
        source: 'file_document',
        id: doc.id,
        claimFileId: doc.entityId,
        entityType: 'claim_file',
        entityId: doc.entityId,
        label: fileNo
          ? `Dosya ${fileNo} — ${doc.documentKind}`
          : doc.documentKind,
        sentAt: doc.whatsappSentAt?.toISOString() ?? null,
      });
    }

    refs.sort((a, b) => {
      const ta = a.sentAt ? new Date(a.sentAt).getTime() : 0;
      const tb = b.sentAt ? new Date(b.sentAt).getTime() : 0;
      return tb - ta;
    });

    return refs.slice(0, limit);
  }
}
