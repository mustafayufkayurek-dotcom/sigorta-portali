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
import { CreateCampaignDto } from './dto/create-campaign.dto';
import { SubmitSurveyDto } from './dto/submit-survey.dto';

@Injectable()
export class SurveysService {
  private readonly logger = new Logger(SurveysService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly whatsapp: WhatsAppService,
    private readonly config: ConfigService,
  ) {}

  // ── Kampanya oluştur ───────────────────────────────────────────────────────

  async createCampaign(dto: CreateCampaignDto) {
    const ir = await this.prisma.invoiceRequest.findUnique({
      where: { id: dto.invoiceRequestId },
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

    // Mükerrer kampanya kontrolü
    const existing = await this.prisma.surveyCampaign.findUnique({
      where: { invoiceRequestId: dto.invoiceRequestId },
    });
    if (existing) return existing;

    const customer = ir.claimFile?.customer;
    const insuredName = customer
      ? (customer.fullName ?? `${customer.firstName ?? ''} ${customer.lastName ?? ''}`.trim())
      : null;
    const insuredPhone = dto.insuredPhone ?? customer?.phone ?? null;

    const insuranceCompanyId =
      ir.insuranceCompanyId ?? ir.claimFile?.insuranceCompany?.id ?? null;

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 90);

    const campaign = await this.prisma.surveyCampaign.create({
      data: {
        claimFileId: ir.claimFileId ?? null,
        emergencyCaseId: ir.emergencyCaseId ?? null,
        invoiceRequestId: ir.id,
        insuranceCompanyId,
        insuredName,
        insuredPhone,
        publicToken: randomUUID(),
        tokenExpiresAt: expiresAt,
        status: 'pending',
      },
    });

    this.logger.log(`Anket kampanyası oluşturuldu → ${campaign.id} (IR: ${ir.id})`);
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

    const webUrl = this.config.get<string>('WEB_URL', 'http://localhost:3001');
    const surveyUrl = `${webUrl}/anket/${campaign.publicToken}`;

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
          q7Comment: dto.q7Comment ?? null,
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
}
