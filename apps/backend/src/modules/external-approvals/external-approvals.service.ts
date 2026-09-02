import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { buildAppPath, resolveAppUrl } from '@/common/utils/app-url';
import { buildWhatsAppMeUrl } from '@/common/utils/whatsapp-phone';
import { randomUUID } from 'crypto';
import { PrismaService } from '@/prisma/prisma.service';
import { ReportPdfService } from '../repair-reports/pdf/report-pdf.service';
import { EmailService } from '@/modules/notifications/email/email.service';
import {
  buildTransactionalEmailHtml,
  buildExternalApprovalSummaryHtml,
  formatSnPersonGreeting,
  organizationLineForMail,
  onarimRaporuRequestSubject,
  raporOnaylandiSubject,
  buildRaporOnaylandiEmailHtml,
} from '@/modules/notifications/email/email.template';
import { buildPanelUrl, panelOnarimRaporuPath } from '@/common/utils/panel-url';
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
      'rejected',
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

    if (dto.action === 'approved' && approval.approverType === 'expert') {
      void this.sendExpertApprovedStaffEmail(approval.id).catch((err) =>
        this.logger.warn(`Eksper onay maili gitmedi (token): ${err instanceof Error ? err.message : err}`),
      );
    }

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

    if (dto.action === 'approved' && approval.approverType === 'expert') {
      void this.sendExpertApprovedStaffEmail(approval.id).catch((err) =>
        this.logger.warn(`Eksper onay maili gitmedi (portal): ${err instanceof Error ? err.message : err}`),
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

  private async sendExpertApprovedStaffEmail(approvalId: string) {
    const approval = await this.prisma.externalApproval.findUnique({
      where: { id: approvalId },
      select: {
        approverType: true,
        approverName: true,
        sentBy: { select: { email: true, firstName: true, lastName: true } },
        approver: { select: { firstName: true, lastName: true } },
        report: {
          select: {
            id: true,
            claimFileId: true,
            claimFile: {
              select: {
                fileNo: true,
                insuranceCompany: { select: { name: true } },
              },
            },
          },
        },
      },
    });
    if (!approval || approval.approverType !== 'expert') return;
    const to = approval.sentBy?.email?.trim();
    if (!to) return;

    const insuranceCompanyName = approval.report?.claimFile?.insuranceCompany?.name ?? '';
    const fileNo = approval.report?.claimFile?.fileNo ?? '';
    const approvedBy = [
      approval.approver?.firstName,
      approval.approver?.lastName,
    ].filter(Boolean).join(' ').trim() || approval.approverName?.trim() || 'Eksper';
    const greeting = formatSnPersonGreeting(
      approval.sentBy?.firstName,
      approval.sentBy?.lastName,
    );
    const appUrl = resolveAppUrl(this.config);
    const actionUrl = approval.report?.claimFileId && approval.report.id
      ? buildPanelUrl(appUrl, panelOnarimRaporuPath(approval.report.claimFileId, approval.report.id))
      : undefined;

    const result = await this.email.sendEmail(
      to,
      raporOnaylandiSubject(insuranceCompanyName, fileNo),
      buildRaporOnaylandiEmailHtml({
        insuranceCompanyName,
        fileNo,
        approvedBy,
        greeting,
        intro: 'Eksper onarım raporunu onaylanmıştır.\nOperasyon planlama aşamasına geçiniz.',
        actionUrl,
        portalUrl: buildAppPath(this.config, '/giris'),
      }),
      {
        text: `Eksper onarım raporunu onaylanmıştır. Operasyon planlama aşamasına geçiniz. Dosya: ${fileNo}`,
        mailbox: 'HASAR',
      },
    );
    if (!result.sent || result.via !== 'graph') {
      this.logger.warn(
        `Eksper onay maili Hasar kutusundan gitmedi (${to}): ${result.errorMsg || result.via || 'graph yok'}`,
      );
    }
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
          select: { id: true, companyName: true, fullName: true, shortName: true, phone: true, email: true },
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

    const approval = await this.prisma.externalApproval.findUnique({
      where: { id: approvalId },
      select: {
        createdAt: true,
        sentAt: true,
        approverType: true,
        approverName: true,
        approver: {
          select: {
            firstName: true,
            lastName: true,
            role: { select: { code: true } },
            adjuster: { select: { company: true, name: true } },
          },
        },
      },
    });
    const insuranceCompanyName = pdfReport.claimFile?.insuranceCompany?.name ?? '';
    const expertFirm =
      pdfReport.expertOffice?.companyName
      || pdfReport.expertOffice?.fullName
      || pdfReport.expertOffice?.shortName
      || approval?.approver?.adjuster?.company
      || approval?.approver?.adjuster?.name
      || '';
    const recipientFirm = approval?.approverType === 'expert' ? expertFirm : insuranceCompanyName;
    const organizationName = organizationLineForMail(
      recipientFirm,
      approval?.approver?.role?.code,
    );
    const greeting = formatSnPersonGreeting(
      approval?.approver?.firstName,
      approval?.approver?.lastName,
      approval?.approverName,
      recipientFirm,
    );

    const result = await this.email.sendEmail(
      email,
      onarimRaporuRequestSubject(
        insuranceCompanyName,
        pdfReport.claimFile?.fileNo,
      ),
      buildTransactionalEmailHtml({
        title: 'Onay Talep',
        organizationName,
        greeting,
        intro: 'Hasar onarım raporu onay ve görüşleriniz beklemektedir.',
        bodyHtml: buildExternalApprovalSummaryHtml({
          insuranceCompanyName,
          fileNo: pdfReport.claimFile?.fileNo ?? '',
          sentAt: approval?.sentAt ?? approval?.createdAt ?? new Date(),
        }),
        actionUrl: approvalUrl,
        actionLabel: 'Raporu İncele ve Onayla',
        footerNote: 'Bu link 72 saat geçerlidir. Sorun yaşarsanız lütfen bizimle iletişime geçin.',
        portalUrl: buildAppPath(this.config, '/giris'),
      }),
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

    if (!result.sent || result.via !== 'graph') {
      throw new BadRequestException(
        result.errorMsg
          || 'E-posta Hasar kutusundan gitmedi. SMTP yeşili “gitti” sayılmaz.',
      );
    }

    this.logger.log(
      `Dış onay maili PDF eki ile gönderildi: ${email} (approval: ${approvalId}, pdfBytes: ${pdfBuffer.length})`,
    );
  }
}
