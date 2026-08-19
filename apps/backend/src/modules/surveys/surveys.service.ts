import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '@/prisma/prisma.service';
import { WhatsAppService } from '@/modules/notifications/whatsapp/whatsapp.service';
import { ConfigService } from '@nestjs/config';
import { buildAppPath } from '@/common/utils/app-url';
import { CreateCampaignDto } from './dto/create-campaign.dto';
import { SubmitSurveyDto } from './dto/submit-survey.dto';
import {
  surveyDissatisfiedCommentMissing,
  SURVEY_DISSATISFIED_COMMENT_MESSAGE,
} from './survey-submit.rule';

const SENT_OR_DONE = ['sent', 'completed'] as const;

@Injectable()
export class SurveysService {
  private readonly logger = new Logger(SurveysService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly whatsapp: WhatsAppService,
    private readonly config: ConfigService,
  ) {}

  private tokenExpiry(): Date {
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 90);
    return expiresAt;
  }

  private customerDisplayName(customer?: {
    fullName?: string | null;
    firstName?: string | null;
    lastName?: string | null;
  } | null): string | null {
    if (!customer) return null;
    const full = customer.fullName?.trim();
    if (full) return full;
    const parts = `${customer.firstName ?? ''} ${customer.lastName ?? ''}`.trim();
    return parts || null;
  }

  private async applyPhoneIfProvided(
    campaign: { id: string; insuredPhone: string | null },
    insuredPhone?: string,
  ) {
    const phone = insuredPhone?.trim();
    if (!phone || phone === campaign.insuredPhone) return campaign;
    return this.prisma.surveyCampaign.update({
      where: { id: campaign.id },
      data: { insuredPhone: phone },
    });
  }

  // ── Kampanya oluştur (fatura veya dosya kapanışı; gönderim yok) ───────────

  async createCampaign(dto: CreateCampaignDto) {
    const invoiceRequestId = dto.invoiceRequestId?.trim() || undefined;
    const claimFileId = dto.claimFileId?.trim() || undefined;
    const emergencyCaseId = dto.emergencyCaseId?.trim() || undefined;

    if (!invoiceRequestId && !claimFileId && !emergencyCaseId) {
      throw new BadRequestException(
        'Fatura Talebi, Hasar Dosyası Veya Acil Yardım Dosyası Gerekli',
      );
    }

    if (invoiceRequestId) {
      return this.createFromInvoiceRequest(invoiceRequestId, dto.insuredPhone);
    }
    if (claimFileId) {
      return this.createFromClaimFile(claimFileId, dto.insuredPhone);
    }
    return this.createFromEmergencyCase(emergencyCaseId!, dto.insuredPhone);
  }

  async ensureCampaignForClaimFile(claimFileId: string) {
    return this.createFromClaimFile(claimFileId);
  }

  async ensureCampaignForEmergencyCase(emergencyCaseId: string) {
    return this.createFromEmergencyCase(emergencyCaseId);
  }

  private async createFromInvoiceRequest(invoiceRequestId: string, insuredPhone?: string) {
    const existingByInvoice = await this.prisma.surveyCampaign.findUnique({
      where: { invoiceRequestId },
    });
    if (existingByInvoice) {
      return this.applyPhoneIfProvided(existingByInvoice, insuredPhone);
    }

    const ir = await this.prisma.invoiceRequest.findUnique({
      where: { id: invoiceRequestId },
      include: {
        claimFile: {
          include: {
            customer: { select: { fullName: true, firstName: true, lastName: true, phone: true } },
            insuranceCompany: { select: { id: true, name: true } },
          },
        },
        insuranceCompany: { select: { id: true, name: true } },
      },
    });

    if (!ir) throw new NotFoundException('Fatura talebi bulunamadı');

    if (ir.claimFileId) {
      const existingFile = await this.prisma.surveyCampaign.findFirst({
        where: { claimFileId: ir.claimFileId },
        orderBy: { createdAt: 'desc' },
      });
      if (existingFile) {
        if (!existingFile.invoiceRequestId) {
          const attached = await this.prisma.surveyCampaign.update({
            where: { id: existingFile.id },
            data: {
              invoiceRequestId: ir.id,
              ...(insuredPhone?.trim() ? { insuredPhone: insuredPhone.trim() } : {}),
            },
          });
          return attached;
        }
        return this.applyPhoneIfProvided(existingFile, insuredPhone);
      }
    }

    if (ir.emergencyCaseId) {
      const existingCase = await this.prisma.surveyCampaign.findFirst({
        where: { emergencyCaseId: ir.emergencyCaseId },
        orderBy: { createdAt: 'desc' },
      });
      if (existingCase) {
        if (!existingCase.invoiceRequestId) {
          return this.prisma.surveyCampaign.update({
            where: { id: existingCase.id },
            data: {
              invoiceRequestId: ir.id,
              ...(insuredPhone?.trim() ? { insuredPhone: insuredPhone.trim() } : {}),
            },
          });
        }
        return this.applyPhoneIfProvided(existingCase, insuredPhone);
      }
    }

    const customer = ir.claimFile?.customer;
    const insuredName = this.customerDisplayName(customer);
    const phone = insuredPhone ?? customer?.phone ?? null;
    const insuranceCompanyId =
      ir.insuranceCompanyId ?? ir.claimFile?.insuranceCompany?.id ?? null;

    const campaign = await this.prisma.surveyCampaign.create({
      data: {
        claimFileId: ir.claimFileId ?? null,
        emergencyCaseId: ir.emergencyCaseId ?? null,
        invoiceRequestId: ir.id,
        insuranceCompanyId,
        insuredName,
        insuredPhone: phone,
        publicToken: randomUUID(),
        tokenExpiresAt: this.tokenExpiry(),
        status: 'pending',
      },
    });

    this.logger.log(`Anket kampanyası oluşturuldu → ${campaign.id} (IR: ${ir.id})`);
    return campaign;
  }

  private async createFromClaimFile(claimFileId: string, insuredPhone?: string) {
    const existing = await this.prisma.surveyCampaign.findFirst({
      where: { claimFileId },
      orderBy: { createdAt: 'desc' },
    });
    if (existing) {
      return this.applyPhoneIfProvided(existing, insuredPhone);
    }

    const file = await this.prisma.claimFile.findUnique({
      where: { id: claimFileId },
      include: {
        customer: { select: { fullName: true, firstName: true, lastName: true, phone: true } },
      },
    });
    if (!file) throw new NotFoundException('Dosya bulunamadı');

    const insuredName =
      file.insuredName?.trim() || this.customerDisplayName(file.customer);
    const phone =
      insuredPhone?.trim() || file.insuredPhone || file.customer?.phone || null;

    const campaign = await this.prisma.surveyCampaign.create({
      data: {
        claimFileId: file.id,
        insuranceCompanyId: file.insuranceCompanyId,
        insuredName,
        insuredPhone: phone,
        publicToken: randomUUID(),
        tokenExpiresAt: this.tokenExpiry(),
        status: 'pending',
      },
    });

    this.logger.log(`Anket kampanyası oluşturuldu → ${campaign.id} (dosya: ${file.fileNo})`);
    return campaign;
  }

  private async createFromEmergencyCase(emergencyCaseId: string, insuredPhone?: string) {
    const existing = await this.prisma.surveyCampaign.findFirst({
      where: { emergencyCaseId },
      orderBy: { createdAt: 'desc' },
    });
    if (existing) {
      return this.applyPhoneIfProvided(existing, insuredPhone);
    }

    const emergencyCase = await this.prisma.emergencyCase.findUnique({
      where: { id: emergencyCaseId },
    });
    if (!emergencyCase) throw new NotFoundException('Acil yardım dosyası bulunamadı');

    const campaign = await this.prisma.surveyCampaign.create({
      data: {
        emergencyCaseId: emergencyCase.id,
        insuredName: emergencyCase.customerName?.trim() || null,
        insuredPhone: insuredPhone?.trim() || emergencyCase.customerPhone || null,
        publicToken: randomUUID(),
        tokenExpiresAt: this.tokenExpiry(),
        status: 'pending',
      },
    });

    this.logger.log(
      `Anket kampanyası oluşturuldu → ${campaign.id} (acil: ${emergencyCase.caseNo})`,
    );
    return campaign;
  }

  // ── WhatsApp deep link gönder ──────────────────────────────────────────────

  async sendSurveyLink(campaignId: string) {
    const campaign = await this.prisma.surveyCampaign.findUnique({
      where: { id: campaignId },
    });
    if (!campaign) throw new NotFoundException('Kampanya bulunamadı');
    if (!campaign.insuredPhone) {
      throw new BadRequestException('Sigortalı telefon numarası tanımlı değil');
    }

    const surveyUrl = buildAppPath(this.config, `/anket/${campaign.publicToken}`);

    const insuredGreeting = campaign.insuredName ? `Sayın ${campaign.insuredName},\n\n` : '';
    const message =
      `${insuredGreeting}Meridyen Assistance olarak hizmetinizden memnun kalmanız bizim için önemlidir.\n\n` +
      `Deneyiminizi değerlendirmeniz için kısa bir anket oluşturduk (yaklaşık 30 saniye):\n\n` +
      `${surveyUrl}\n\n` +
      `İlginiz için teşekkür ederiz.`;

    const deepLink = this.whatsapp.buildWhatsAppUrl(campaign.insuredPhone, message);

    const updated = await this.prisma.surveyCampaign.update({
      where: { id: campaignId },
      data: {
        whatsappDeepLink: deepLink,
        whatsappSentAt: new Date(),
        status: 'sent',
      },
    });

    this.logger.log(`Anket deep link oluşturuldu → kampanya: ${campaignId}`);
    return { deepLink, campaign: updated };
  }

  // ── Token ile kampanya bul (public) ───────────────────────────────────────

  async findByToken(token: string) {
    const campaign = await this.prisma.surveyCampaign.findUnique({
      where: { publicToken: token },
      include: { response: true },
    });

    if (!campaign) throw new NotFoundException('Anket bulunamadı');

    if (campaign.tokenExpiresAt && campaign.tokenExpiresAt < new Date()) {
      await this.prisma.surveyCampaign.update({
        where: { id: campaign.id },
        data: { status: 'expired' },
      });
      throw new BadRequestException('Anketin süresi dolmuş');
    }

    if (campaign.status === 'completed') {
      throw new BadRequestException('Bu anket zaten yanıtlanmış');
    }

    return {
      id: campaign.id,
      insuredName: campaign.insuredName,
      status: campaign.status,
      tokenExpiresAt: campaign.tokenExpiresAt,
    };
  }

  // ── Yanıt gönder (public) ─────────────────────────────────────────────────

  async submitResponse(token: string, dto: SubmitSurveyDto, ipAddress?: string) {
    const campaign = await this.prisma.surveyCampaign.findUnique({
      where: { publicToken: token },
    });

    if (!campaign) throw new NotFoundException('Anket bulunamadı');

    if (campaign.tokenExpiresAt && campaign.tokenExpiresAt < new Date()) {
      throw new BadRequestException('Anketin süresi dolmuş');
    }

    if (campaign.status === 'completed') {
      throw new BadRequestException('Bu anket zaten yanıtlanmış');
    }

    if (surveyDissatisfiedCommentMissing(dto.q6Recommend, dto.q7Comment)) {
      throw new BadRequestException(SURVEY_DISSATISFIED_COMMENT_MESSAGE);
    }

    await this.prisma.$transaction([
      this.prisma.surveyResponse.create({
        data: {
          campaignId: campaign.id,
          q1Rating: dto.q1Rating,
          q2Rating: dto.q2Rating,
          q3Rating: dto.q3Rating,
          q4Rating: dto.q4Rating,
          q5Rating: dto.q5Rating,
          q6Recommend: dto.q6Recommend,
          q7Comment: dto.q7Comment?.trim() || null,
          ipAddress: ipAddress ?? null,
        },
      }),
      this.prisma.surveyCampaign.update({
        where: { id: campaign.id },
        data: { status: 'completed', completedAt: new Date() },
      }),
    ]);

    this.logger.log(`Anket yanıtlandı → kampanya: ${campaign.id}`);
    return { success: true };
  }

  // ── Yönetim paneli: kampanya listesi ──────────────────────────────────────

  async findAll(insuranceCompanyId?: string) {
    return this.prisma.surveyCampaign.findMany({
      where: insuranceCompanyId ? { insuranceCompanyId } : undefined,
      include: {
        response: true,
        insuranceCompany: { select: { name: true } },
        invoiceRequest: { select: { requestNo: true, fileNo: true } },
        claimFile: { select: { fileNo: true, id: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  // ── Kampanya detayı ───────────────────────────────────────────────────────

  async findOne(id: string) {
    const c = await this.prisma.surveyCampaign.findUnique({
      where: { id },
      include: {
        response: true,
        insuranceCompany: { select: { name: true } },
        invoiceRequest: { select: { requestNo: true, fileNo: true } },
        claimFile: { select: { fileNo: true, id: true } },
      },
    });
    if (!c) throw new NotFoundException('Kampanya bulunamadı');
    return c;
  }

  // ── InvoiceRequest id'si ile kampanya bul ─────────────────────────────────

  async findByInvoiceRequest(invoiceRequestId: string) {
    return this.prisma.surveyCampaign.findUnique({
      where: { invoiceRequestId },
      include: { response: true },
    });
  }

  async findByClaimFile(claimFileId: string) {
    return this.prisma.surveyCampaign.findFirst({
      where: { claimFileId },
      include: { response: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findByEmergencyCase(emergencyCaseId: string) {
    return this.prisma.surveyCampaign.findFirst({
      where: { emergencyCaseId },
      include: { response: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  /** Dosya sorumlusuna atanan, kapanmış ve anket linki gönderilmemiş dosyalar. */
  async listClosureUnsent(userId: string) {
    if (!userId) return [];

    return this.prisma.claimFile.findMany({
      where: {
        assignedOfficeUserId: userId,
        closedAt: { not: null },
        currentStatus: { isClosedState: true },
        surveyCampaigns: {
          none: {
            OR: [{ whatsappSentAt: { not: null } }, { status: { in: [...SENT_OR_DONE] } }],
          },
        },
      },
      select: {
        id: true,
        fileNo: true,
        closedAt: true,
        insuredName: true,
        customer: { select: { fullName: true } },
      },
      orderBy: { closedAt: 'desc' },
      take: 50,
    });
  }
}
