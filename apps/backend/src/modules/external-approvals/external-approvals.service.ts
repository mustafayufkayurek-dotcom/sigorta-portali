import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { buildAppPath } from '@/common/utils/app-url';
import { buildWhatsAppMeUrl } from '@/common/utils/whatsapp-phone';
import { randomUUID } from 'crypto';
import { PrismaService } from '@/prisma/prisma.service';
import { ReportPdfService } from '../repair-reports/pdf/report-pdf.service';
import { EmailService } from '@/modules/notifications/email/email.service';
import { SendExternalApprovalDto, RespondExternalApprovalDto } from './dto/external-approvals.dto';

@Injectable()
export class ExternalApprovalsService {
  private readonly logger = new Logger(ExternalApprovalsService.name);

  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
    private pdfService: ReportPdfService,
    private email: EmailService,
  ) {}

  // ── Gönderim ──────────────────────────────────────────────────────────────

  async send(reportId: string, dto: SendExternalApprovalDto, sentByUserId: string) {
    const report = await this.prisma.repairReport.findUnique({
      where: { id: reportId },
      include: {
        claimFile: { include: { insuranceCompany: true, customer: true } },
        createdBy: { select: { id: true, firstName: true, lastName: true } },
      },
    });
    if (!report) throw new NotFoundException('Rapor bulunamadı');

    const allowedStatuses = [
      'draft',
      'approved',
      'sent_for_external_approval',
      'submitted',
      'pending_approval',
    ];
    if (!allowedStatuses.includes(report.status)) {
      throw new BadRequestException('Yalnızca yazılmış / onay sürecindeki raporlar dış onaya gönderilebilir');
    }

    const token = randomUUID();
    const expiresInHours = dto.expiresInHours ?? 72;
    const expiresAt = new Date(Date.now() + expiresInHours * 60 * 60 * 1000);

    const approval = await this.prisma.externalApproval.create({
      data: {
        reportId,
        approverType: dto.approverType,
        approverId: dto.approverId,
        approverName: dto.approverName,
        approverEmail: dto.approverEmail,
        approverPhone: dto.approverPhone,
        channel: dto.channel,
        token,
        expiresAt,
        sentByUserId,
      },
    });

    if (dto.channel === 'email' && dto.approverEmail) {
      try {
        await this.sendApprovalEmail(approval.id, reportId, dto.approverEmail, token);
      } catch (err) {
        await this.prisma.externalApproval.delete({ where: { id: approval.id } }).catch(() => undefined);
        throw err;
      }
    }

    await this.prisma.repairReport.update({
      where: { id: reportId },
      data: { status: 'sent_for_external_approval' },
    });

    await this.prisma.reportApprovalHistory.create({
      data: {
        reportId,
        userId: sentByUserId,
        action: 'sent_for_external_approval',
        reason: `${dto.channel} kanalı üzerinden ${dto.approverType === 'expert' ? 'ekspere' : 'sigorta şirketine'} gönderildi`,
      },
    });

    // In-app bildirim (approverId varsa)
    if (dto.approverId && dto.channel === 'in_app') {
      await this.prisma.notification.create({
        data: {
          userId: dto.approverId,
          type: 'external_approval_requested',
          title: 'Onay Bekleniyor',
          body: `${report.reportNo} numaralı rapor onayınızı bekliyor.`,
          channel: 'in_app',
          status: 'pending',
          relatedEntityType: 'external_approval',
          relatedEntityId: approval.id,
        },
      });
    }

    const publicUrl = this.buildPublicUrl(token);
    const whatsappUrl = this.buildWhatsAppUrl(token, report.reportNo, dto.approverPhone);

    return { data: { ...approval, publicUrl, whatsappUrl } };
  }

  // ── Public: Token ile raporu görüntüle ──────────────────────────────────

  async getByToken(token: string) {
    const approval = await this.prisma.externalApproval.findUnique({
      where: { token },
      include: {
        report: {
          include: {
            claimFile: {
              include: { insuranceCompany: true, customer: true, propertyAddress: true },
            },
            items: { include: { workGroup: true, damageType: true }, orderBy: [{ workGroup: { sortOrder: 'asc' } }, { sortOrder: 'asc' }] },
            damageTypes: { orderBy: { sortOrder: 'asc' } },
            images: { orderBy: { sortOrder: 'asc' } },
            createdBy: { select: { id: true, firstName: true, lastName: true } },
          },
        },
        sentBy: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    if (!approval) throw new NotFoundException('Geçersiz onay linki');

    if (approval.status === 'expired' || approval.expiresAt < new Date()) {
      if (approval.status !== 'expired') {
        await this.prisma.externalApproval.update({ where: { token }, data: { status: 'expired' } });
      }
      throw new BadRequestException('Bu onay linkinin süresi dolmuş');
    }

    if (approval.status !== 'pending') {
      return { data: approval, alreadyResponded: true };
    }

    return { data: approval, alreadyResponded: false };
  }

  // ── Public: Token ile yanıt ver ─────────────────────────────────────────

  async respond(token: string, dto: RespondExternalApprovalDto) {
    const approval = await this.prisma.externalApproval.findUnique({ where: { token } });
    if (!approval) throw new NotFoundException('Geçersiz onay linki');

    if (approval.status === 'expired' || approval.expiresAt < new Date()) {
      throw new BadRequestException('Bu onay linkinin süresi dolmuş');
    }
    if (approval.status !== 'pending') {
      throw new BadRequestException('Bu onay isteği zaten yanıtlanmış');
    }

    const newStatus = dto.action === 'approved' ? 'approved' : 'rejected';
    const reportStatus = dto.action === 'approved' ? 'externally_approved' : 'externally_rejected';

    await this.prisma.$transaction(async (tx) => {
      await tx.externalApproval.update({
        where: { token },
        data: {
          status: newStatus,
          respondedAt: new Date(),
          comments: dto.comments,
        },
      });

      await tx.repairReport.update({
        where: { id: approval.reportId },
        data: { status: reportStatus },
      });

      await tx.reportApprovalHistory.create({
        data: {
          reportId: approval.reportId,
          userId: approval.sentByUserId,
          action: reportStatus,
          reason: dto.comments,
        },
      });
    });

    // Gönderen kişiye bildirim
    await this.prisma.notification.create({
      data: {
        userId: approval.sentByUserId,
        type: dto.action === 'approved' ? 'external_approval_approved' : 'external_approval_rejected',
        title: dto.action === 'approved' ? 'Dış Onay Verildi' : 'Dış Onay Reddedildi',
        body: dto.action === 'approved'
          ? `Dış onay talebiniz onaylandı.`
          : `Dış onay talebiniz reddedildi. ${dto.comments ? `Neden: ${dto.comments}` : ''}`,
        channel: 'in_app',
        status: 'pending',
        relatedEntityType: 'external_approval',
        relatedEntityId: approval.id,
      },
    });

    return { message: dto.action === 'approved' ? 'Onay verildi' : 'Red bildirildi' };
  }

  // ── Authenticated: ID ile yanıt ver (portal kullanıcıları) ────────────────

  async respondAuth(
    id: string,
    dto: RespondExternalApprovalDto,
    user: { id: string; roleCode?: string; insuranceCompanyScopes?: string[] },
  ) {
    const approval = await this.prisma.externalApproval.findUnique({
      where: { id },
      include: {
        report: {
          select: {
            claimFile: { select: { insuranceCompanyId: true } },
          },
        },
      },
    });
    if (!approval) throw new NotFoundException('Onay kaydı bulunamadı');

    this.assertInsuranceApprovalAccess(approval, user);

    if (approval.status === 'expired' || approval.expiresAt < new Date()) {
      throw new BadRequestException('Bu onay isteğinin süresi dolmuş');
    }

    if (approval.status !== 'pending') {
      throw new BadRequestException('Bu onay isteği zaten yanıtlanmış');
    }

    const newStatus = dto.action === 'approved' ? 'approved' : 'rejected';
    const reportStatus = dto.action === 'approved' ? 'externally_approved' : 'externally_rejected';
    const historyUserId = user.id || approval.sentByUserId;

    await this.prisma.$transaction(async (tx) => {
      await tx.externalApproval.update({
        where: { id },
        data: { status: newStatus, respondedAt: new Date(), comments: dto.comments },
      });

      await tx.repairReport.update({
        where: { id: approval.reportId },
        data: { status: reportStatus },
      });

      await tx.reportApprovalHistory.create({
        data: {
          reportId: approval.reportId,
          userId: historyUserId,
          action: reportStatus,
          reason: dto.comments,
        },
      });
    });

    // Bildirim onay sonucunu engellemesin (gönderen kullanıcı silinmiş olabilir)
    try {
      await this.prisma.notification.create({
        data: {
          userId: approval.sentByUserId,
          type: dto.action === 'approved' ? 'external_approval_approved' : 'external_approval_rejected',
          title: dto.action === 'approved' ? 'Dış Onay Verildi' : 'Dış Onay Reddedildi',
          body: dto.action === 'approved'
            ? 'Dış onay talebiniz onaylandı.'
            : `Dış onay talebiniz reddedildi.${dto.comments ? ` Neden: ${dto.comments}` : ''}`,
          channel: 'in_app',
          status: 'pending',
          relatedEntityType: 'external_approval',
          relatedEntityId: approval.id,
        },
      });
    } catch (err) {
      this.logger.warn(
        `Onay bildirimi oluşturulamadı (approval=${id}): ${err instanceof Error ? err.message : err}`,
      );
    }

    return { message: dto.action === 'approved' ? 'Onay verildi' : 'Red bildirildi' };
  }

  // ── Sigorta portalı: iç onay sonrası otomatik kayıt ───────────────────────

  async ensureInsurancePortalApproval(
    reportId: string,
    sentByUserId: string,
    insuranceCompanyId: string,
    insuranceCompanyName: string,
  ) {
    const existing = await this.prisma.externalApproval.findFirst({
      where: {
        reportId,
        approverType: 'insurance_company',
        channel: 'in_app',
        status: 'pending',
        expiresAt: { gt: new Date() },
      },
    });
    if (existing) return existing;

    const token = randomUUID();
    const expiresAt = new Date(Date.now() + 72 * 60 * 60 * 1000);

    const approval = await this.prisma.externalApproval.create({
      data: {
        reportId,
        approverType: 'insurance_company',
        approverName: insuranceCompanyName,
        channel: 'in_app',
        token,
        expiresAt,
        sentByUserId,
      },
    });

    await this.prisma.reportApprovalHistory.create({
      data: {
        reportId,
        userId: sentByUserId,
        action: 'sent_for_external_approval',
        reason: 'Sigorta portalına otomatik gönderildi (iç onay sonrası)',
      },
    });

    this.logger.log(
      `Sigorta portalı onay kaydı oluşturuldu: report=${reportId} company=${insuranceCompanyId}`,
    );

    return approval;
  }

  // ── Listeleme ─────────────────────────────────────────────────────────────

  async listPendingForInsuranceCompanies(companyIds: string[], includeExpired = false) {
    if (!companyIds.length) return { data: [] };

    await this.prisma.externalApproval.updateMany({
      where: { status: 'pending', expiresAt: { lt: new Date() } },
      data: { status: 'expired' },
    });

    const data = await this.prisma.externalApproval.findMany({
      where: {
        approverType: 'insurance_company',
        status: includeExpired ? { in: ['pending', 'expired'] } : 'pending',
        report: {
          claimFile: {
            insuranceCompanyId: { in: companyIds },
          },
        },
      },
      include: {
        report: {
          select: {
            id: true,
            reportNo: true,
            status: true,
            versionNo: true,
            totalSalesAmount: true,
            claimFile: {
              select: {
                id: true,
                fileNo: true,
                lossType: true,
                claimSubject: { select: { name: true } },
                insuranceCompany: { select: { name: true } },
              },
            },
          },
        },
        sentBy: { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy: { sentAt: 'desc' },
    });

    return { data };
  }

  async listPendingForAssistantCustomers(customerIds: string[], includeExpired = false) {
    if (!customerIds.length) return { data: [] };

    await this.prisma.externalApproval.updateMany({
      where: { status: 'pending', expiresAt: { lt: new Date() } },
      data: { status: 'expired' },
    });

    const data = await this.prisma.externalApproval.findMany({
      where: {
        status: includeExpired ? { in: ['pending', 'expired'] } : 'pending',
        report: {
          claimFile: {
            customerId: { in: customerIds },
          },
        },
      },
      include: {
        report: {
          select: {
            id: true,
            reportNo: true,
            status: true,
            versionNo: true,
            totalSalesAmount: true,
            claimFile: {
              select: {
                id: true,
                fileNo: true,
                lossType: true,
                claimSubject: { select: { name: true } },
                insuranceCompany: { select: { name: true } },
                customer: { select: { companyName: true, fullName: true } },
              },
            },
          },
        },
        sentBy: { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy: { sentAt: 'desc' },
    });

    return { data };
  }

  async listPending(approverType?: string, approverId?: string, includeExpired = false) {
    const baseWhere: Record<string, unknown> = {};
    if (approverType) baseWhere['approverType'] = approverType;
    if (approverId) baseWhere['approverId'] = approverId;

    // Süresi dolmuş olanları listeleme öncesi güncelle.
    await this.prisma.externalApproval.updateMany({
      where: { status: 'pending', expiresAt: { lt: new Date() } },
      data: { status: 'expired' },
    });

    const where: Record<string, unknown> = {
      ...baseWhere,
      status: includeExpired ? { in: ['pending', 'expired'] } : 'pending',
    };

    const data = await this.prisma.externalApproval.findMany({
      where,
      include: {
        report: {
          select: {
            id: true,
            reportNo: true,
            status: true,
            versionNo: true,
            totalSalesAmount: true,
            claimFile: { select: { fileNo: true, lossType: true, insuranceCompany: { select: { name: true } } } },
          },
        },
        sentBy: { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy: { sentAt: 'desc' },
    });

    return { data };
  }

  async getDetail(
    id: string,
    user?: { id?: string; roleCode?: string; insuranceCompanyScopes?: string[] },
  ) {
    const approval = await this.prisma.externalApproval.findUnique({
      where: { id },
      include: {
        report: {
          include: {
            claimFile: { include: { insuranceCompany: true, customer: true } },
            createdBy: { select: { id: true, firstName: true, lastName: true } },
          },
        },
        sentBy: { select: { id: true, firstName: true, lastName: true } },
        approver: { select: { id: true, firstName: true, lastName: true } },
      },
    });
    if (!approval) throw new NotFoundException('Onay talebi bulunamadı');
    if (user) {
      this.assertInsuranceApprovalAccess(approval, {
        id: user.id ?? '',
        roleCode: user.roleCode,
        insuranceCompanyScopes: user.insuranceCompanyScopes,
      });
    }
    return { data: approval };
  }

  async listByReport(reportId: string) {
    const data = await this.prisma.externalApproval.findMany({
      where: { reportId },
      include: {
        sentBy: { select: { id: true, firstName: true, lastName: true } },
        approver: { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    return { data };
  }

  // ── Yardımcılar ───────────────────────────────────────────────────────────

  private assertInsuranceApprovalAccess(
    approval: {
      report?: { claimFile?: { insuranceCompanyId?: string | null } | null } | null;
    },
    user: { id: string; roleCode?: string; insuranceCompanyScopes?: string[] },
  ) {
    if (user.roleCode !== 'insurance_company_user') return;
    const scopes = user.insuranceCompanyScopes ?? [];
    const companyId = approval.report?.claimFile?.insuranceCompanyId ?? '';
    if (!scopes.length || !companyId || !scopes.includes(companyId)) {
      throw new ForbiddenException('Bu onay kaydına erişim izniniz bulunmamaktadır');
    }
  }

  private buildPublicUrl(token: string): string {
    return buildAppPath(this.config, `/onay/${token}`);
  }

  private buildWhatsAppUrl(token: string, reportNo: string, phone?: string): string {
    const url = this.buildPublicUrl(token);
    const message = `${reportNo} numaralı hasar onarım raporunu onaylamanız bekleniyor: ${url}`;
    return buildWhatsAppMeUrl(phone, message) ?? `https://api.whatsapp.com/send?text=${encodeURIComponent(message)}`;
  }

  private async sendApprovalEmail(
    approvalId: string,
    reportId: string,
    email: string,
    token: string,
  ) {
    const approvalUrl = this.buildPublicUrl(token);
    const pdfReport = await this.prisma.repairReport.findUnique({
      where: { id: reportId },
      include: {
        claimFile: {
          select: {
            id: true,
            fileNo: true,
            claimNo: true,
            lossType: true,
            insuredName: true,
            insuredPhone: true,
            commercialTitle: true,
            insuranceCompany: { select: { name: true } },
            customer: { select: { fullName: true, companyName: true, entityType: true, subType: true, firstName: true, lastName: true } },
            claimSubject: { select: { name: true } },
            propertyAddress: { select: { city: true, district: true, addressLine: true } },
            assignedOfficeUser: { select: { firstName: true, lastName: true } },
          },
        },
        expertOffice: {
          select: { id: true, companyName: true, phone: true, email: true },
        },
        originalReport: { select: { id: true, reportNo: true, versionNo: true, createdAt: true } },
        items: {
          include: { workGroup: true, damageType: true },
          orderBy: [{ workGroup: { sortOrder: 'asc' } }, { sortOrder: 'asc' }],
        },
        images: { orderBy: { sortOrder: 'asc' } },
        damageTypes: { orderBy: { sortOrder: 'asc' } },
        approvalHistory: {
          include: {
            user: { select: { id: true, firstName: true, lastName: true } },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });
    if (!pdfReport) throw new NotFoundException('Rapor bulunamadı');

    let pdfBuffer: Buffer | null = null;
    try {
      pdfBuffer = await this.pdfService.generate(pdfReport as any, 'external');
    } catch (pdfErr) {
      this.logger.error(
        `Dış onay maili için PDF üretilemedi (approval: ${approvalId}): ${(pdfErr as Error)?.message ?? pdfErr}`,
      );
    }

    if (!pdfBuffer?.length) {
      throw new BadRequestException('PDF ek oluşmadan dış onay maili gönderilemez');
    }

    const result = await this.email.sendEmail(
      email,
      `Onay Talebi: ${pdfReport.reportNo} — Hasar Onarım Raporu`,
      `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #1e40af;">Hasar Onarım Raporu Onay Talebi</h2>
            <p>Sayın yetkili,</p>
            <p><strong>${pdfReport.reportNo}</strong> numaralı hasar onarım raporu onayınızı beklemektedir.</p>
            <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin: 20px 0;">
              <p style="margin: 4px 0;"><strong>Rapor No:</strong> ${pdfReport.reportNo}</p>
              <p style="margin: 4px 0;"><strong>Hasar Dosya No:</strong> ${pdfReport.claimFile?.fileNo ?? '—'}</p>
              <p style="margin: 4px 0;"><strong>Sigorta Şirketi:</strong> ${pdfReport.claimFile?.insuranceCompany?.name ?? '—'}</p>
            </div>
            <p>Rapor PDF ektedir. İncelemek ve onaylamak için aşağıdaki linke tıklayın:</p>
            <a href="${approvalUrl}" style="display: inline-block; background: #2563eb; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold;">
              Raporu İncele ve Onayla
            </a>
            <p style="margin-top: 20px; color: #64748b; font-size: 12px;">
              Bu link 72 saat geçerlidir. Sorun yaşarsanız lütfen bizimle iletişime geçin.
            </p>
          </div>
        `,
      {
        text: `${pdfReport.reportNo} numaralı hasar onarım raporu onayınızı bekliyor: ${approvalUrl}`,
        attachments: [
          {
            filename: `hasar-raporu-DIS-${pdfReport.reportNo}.pdf`,
            content: pdfBuffer,
            contentType: 'application/pdf',
          },
        ],
      },
    );

    if (!result.sent) {
      throw new BadRequestException(
        result.errorMsg
          || 'E-posta gönderilemedi. Ayarlar → E-posta Bildirimleri mail kurulumunu kontrol edin.',
      );
    }

    this.logger.log(
      `Dış onay maili PDF eki ile gönderildi: ${email} (approval: ${approvalId}, pdfBytes: ${pdfBuffer.length})`,
    );
  }
}
