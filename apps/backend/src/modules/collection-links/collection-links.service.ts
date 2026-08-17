import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import { PrismaService } from '@/prisma/prisma.service';
import { PaymentsService } from '../payments/payments.service';
import { PaytrCallbackPayload, PaytrService } from './paytr.service';
import { CreateCollectionLinkDto } from './dto/create-collection-link.dto';
import { resolveAppUrl } from '@/common/utils/app-url';

const LINK_TTL_DAYS = 14;
const ACTIVE_LINK_STATUSES = ['draft', 'sent', 'opened', 'processing'] as const;

@Injectable()
export class CollectionLinksService {
  private readonly logger = new Logger(CollectionLinksService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly paytr: PaytrService,
    private readonly payments: PaymentsService,
    private readonly config: ConfigService,
  ) {}

  private assertEnabled() {
    if (!this.paytr.isEnabled()) {
      throw new ForbiddenException('Online kart tahsilat şu an devre dışı.');
    }
  }

  private appPublicUrl(): string {
    return resolveAppUrl(this.config);
  }

  private buildMerchantOid(): string {
    return `cl${randomUUID().replace(/-/g, '').slice(0, 30)}`;
  }

  async findByClaimFile(claimFileId: string) {
    const links = await this.prisma.paymentCollectionLink.findMany({
      where: { claimFileId },
      orderBy: { createdAt: 'desc' },
      include: {
        revenue: { select: { id: true, description: true, totalAmount: true, status: true } },
        createdBy: { select: { id: true, firstName: true, lastName: true } },
      },
    });
    return links.map((l) => this.toPublicLink(l));
  }

  async create(dto: CreateCollectionLinkDto, userId: string) {
    this.assertEnabled();

    const claimFile = await this.prisma.claimFile.findUnique({
      where: { id: dto.claimFileId },
      include: { customer: true },
    });
    if (!claimFile) throw new NotFoundException('Hasar dosyası bulunamadı');

    let revenue: { id: string; totalAmount: number; collectedAmount: number; status: string } | null = null;
    if (dto.revenueId) {
      revenue = await this.prisma.claimFileRevenue.findFirst({
        where: { id: dto.revenueId, claimFileId: dto.claimFileId },
        select: { id: true, totalAmount: true, collectedAmount: true, status: true },
      });
      if (!revenue) throw new NotFoundException('Gelir kalemi bulunamadı');
      if (['collected', 'cancelled'].includes(revenue.status)) {
        throw new BadRequestException('Bu gelir kalemi için tahsilat zaten tamamlanmış veya iptal.');
      }
    }

    const payerName =
      dto.payerName?.trim() ||
      claimFile.insuredName ||
      claimFile.customer?.fullName ||
      `${claimFile.customer?.firstName ?? ''} ${claimFile.customer?.lastName ?? ''}`.trim() ||
      'Sigortalı';
    const payerEmail = dto.payerEmail?.trim() || claimFile.customer?.email || 'odeme@meridyen-tr.com';
    const payerPhone = dto.payerPhone?.trim() || claimFile.insuredPhone || claimFile.customer?.phone || '05000000000';

    const tokenExpiresAt = new Date(Date.now() + LINK_TTL_DAYS * 24 * 60 * 60 * 1000);
    const publicToken = randomUUID();
    const merchantOid = this.buildMerchantOid();

    const link = await this.prisma.paymentCollectionLink.create({
      data: {
        claimFileId: dto.claimFileId,
        revenueId: dto.revenueId ?? null,
        merchantOid,
        amount: dto.amount,
        currency: 'TRY',
        publicToken,
        tokenExpiresAt,
        status: 'sent',
        payerName,
        payerPhone,
        payerEmail,
        description: dto.description ?? (revenue ? `Dosya ${claimFile.fileNo} tahsilatı` : `Dosya ${claimFile.fileNo} online tahsilat`),
        sentAt: new Date(),
        provider: 'paytr',
        createdByUserId: userId,
      },
    });

    await this.prisma.claimFile.update({
      where: { id: dto.claimFileId },
      data: {
        requiresOnlineCardCollection: true,
        onlineCardCollectionStatus: 'link_sent',
      },
    });

    return this.toPublicLink(link, `${this.appPublicUrl()}/odeme/${publicToken}`);
  }

  async cancel(linkId: string, _userId: string) {
    const link = await this.prisma.paymentCollectionLink.findUnique({ where: { id: linkId } });
    if (!link) throw new NotFoundException('Ödeme linki bulunamadı');
    if (link.status === 'paid') throw new BadRequestException('Ödenmiş link iptal edilemez.');
    if (!ACTIVE_LINK_STATUSES.includes(link.status as (typeof ACTIVE_LINK_STATUSES)[number])) {
      throw new BadRequestException('Bu link zaten kapatılmış.');
    }

    const updated = await this.prisma.paymentCollectionLink.update({
      where: { id: linkId },
      data: { status: 'cancelled' },
    });
    return this.toPublicLink(updated);
  }

  async getPublicSummary(token: string) {
    const link = await this.prisma.paymentCollectionLink.findUnique({
      where: { publicToken: token },
      include: {
        claimFile: {
          select: {
            fileNo: true,
            insuredName: true,
            insuranceCompany: { select: { name: true } },
          },
        },
      },
    });
    if (!link) throw new NotFoundException('Ödeme linki bulunamadı veya süresi dolmuş.');

    const expired = link.tokenExpiresAt < new Date();
    const payable =
      !expired &&
      ['sent', 'opened', 'processing', 'draft'].includes(link.status) &&
      this.paytr.isEnabled();

    return {
      id: link.id,
      amount: link.amount,
      currency: link.currency,
      status: expired && link.status !== 'paid' ? 'expired' : link.status,
      description: link.description,
      payerName: link.payerName,
      fileNo: link.claimFile.fileNo,
      insuredName: link.claimFile.insuredName,
      insuranceCompany: link.claimFile.insuranceCompany?.name ?? null,
      tokenExpiresAt: link.tokenExpiresAt,
      payable,
      providerConfigured: this.paytr.isConfigured(),
    };
  }

  async startCheckout(token: string, userIp: string) {
    this.assertEnabled();
    if (!this.paytr.isConfigured()) {
      throw new BadRequestException('PayTR yapılandırması eksik. Lütfen sistem yöneticisine başvurun.');
    }

    const link = await this.prisma.paymentCollectionLink.findUnique({
      where: { publicToken: token },
      include: { claimFile: { select: { fileNo: true } } },
    });
    if (!link) throw new NotFoundException('Ödeme linki bulunamadı.');
    if (link.tokenExpiresAt < new Date()) {
      await this.prisma.paymentCollectionLink.update({ where: { id: link.id }, data: { status: 'expired' } });
      throw new BadRequestException('Ödeme linkinin süresi dolmuş.');
    }
    if (link.status === 'paid') throw new BadRequestException('Bu link için ödeme zaten alınmış.');
    if (link.status === 'cancelled') throw new BadRequestException('Ödeme linki iptal edilmiş.');

    const baseUrl = this.appPublicUrl();
    const iframeToken = await this.paytr.getIframeToken({
      merchantOid: link.merchantOid,
      userIp: userIp || '127.0.0.1',
      email: link.payerEmail ?? 'odeme@meridyen-tr.com',
      amount: link.amount,
      userName: link.payerName ?? 'Sigortalı',
      userAddress: 'Türkiye',
      userPhone: link.payerPhone ?? '05000000000',
      userBasket: [[link.description ?? `Dosya ${link.claimFile.fileNo}`, link.amount.toFixed(2), 1]],
      okUrl: `${baseUrl}/odeme/${token}?sonuc=basarili`,
      failUrl: `${baseUrl}/odeme/${token}?sonuc=basarisiz`,
    });

    await this.prisma.paymentCollectionLink.update({
      where: { id: link.id },
      data: { status: link.status === 'sent' ? 'opened' : link.status },
    });

    return { iframeToken, iframeUrl: `https://www.paytr.com/odeme/guvenli/${iframeToken}` };
  }

  async handlePaytrCallback(payload: PaytrCallbackPayload): Promise<'OK'> {
    if (!this.paytr.verifyCallback(payload)) {
      this.logger.error(`PayTR hash doğrulaması başarısız: ${payload.merchant_oid}`);
      throw new BadRequestException('Geçersiz bildirim');
    }

    const link = await this.prisma.paymentCollectionLink.findUnique({
      where: { merchantOid: payload.merchant_oid },
    });
    if (!link) {
      this.logger.warn(`PayTR bildirimi bilinmeyen merchant_oid: ${payload.merchant_oid}`);
      return 'OK';
    }

    if (link.status === 'paid') {
      return 'OK';
    }

    if (payload.status === 'success') {
      const paidAmount = Number(payload.total_amount) / 100;
      const payment = await this.payments.completeOnlineCardPayment({
        claimFileId: link.claimFileId,
        amount: paidAmount > 0 ? paidAmount : link.amount,
        collectionLinkId: link.id,
        providerRef: payload.merchant_oid,
        userId: link.createdByUserId,
        revenueId: link.revenueId ?? undefined,
        note: 'PayTR online kart tahsilatı',
      });

      await this.prisma.paymentCollectionLink.update({
        where: { id: link.id },
        data: {
          status: 'paid',
          paidAt: new Date(),
          paymentId: payment.id,
          providerRef: payload.merchant_oid,
          providerPayload: payload as object,
        },
      });

      await this.prisma.claimFile.update({
        where: { id: link.claimFileId },
        data: { onlineCardCollectionStatus: 'paid' },
      });
    } else {
      await this.prisma.paymentCollectionLink.update({
        where: { id: link.id },
        data: {
          status: 'failed',
          failReason:
            (payload.failed_reason_msg as string | undefined) ??
            (payload.failed_reason_code as string | undefined) ??
            'Ödeme başarısız',
          providerPayload: payload as object,
        },
      });
      await this.prisma.claimFile.update({
        where: { id: link.claimFileId },
        data: { onlineCardCollectionStatus: 'failed' },
      });
    }

    return 'OK';
  }

  private toPublicLink(link: any, paymentUrl?: string) {
    return {
      id: link.id,
      claimFileId: link.claimFileId,
      revenueId: link.revenueId,
      amount: link.amount,
      currency: link.currency,
      status: link.status,
      payerName: link.payerName,
      payerPhone: link.payerPhone,
      payerEmail: link.payerEmail,
      description: link.description,
      tokenExpiresAt: link.tokenExpiresAt,
      sentAt: link.sentAt,
      paidAt: link.paidAt,
      paymentUrl: paymentUrl ?? `${this.appPublicUrl()}/odeme/${link.publicToken}`,
      revenue: link.revenue ?? undefined,
      createdBy: link.createdBy ?? undefined,
      createdAt: link.createdAt,
    };
  }
}
