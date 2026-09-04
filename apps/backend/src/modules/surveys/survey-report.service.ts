import { Injectable, Logger, BadRequestException, ForbiddenException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import { EmailService } from '@/modules/notifications/email/email.service';
import { buildSurveyReportHtml, SurveyReportData } from './survey-report.template';

type SurveyCampaignScope = Prisma.SurveyCampaignWhereInput;

type MonthlyReportTarget = {
  kind: 'insurance' | 'assistance' | 'expert' | 'broker';
  name: string;
  email: string;
  campaignWhere: SurveyCampaignScope;
};

function firmName(c: {
  companyName?: string | null;
  fullName?: string | null;
  shortName?: string | null;
}): string {
  return String(c.companyName || c.fullName || c.shortName || '').trim();
}

export const MONTH_NAMES_TR = [
  'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
  'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık',
];

export function monthlySurveyReportSubject(firmName: string, month: number, year: number): string {
  const firm = String(firmName || '').trim();
  const period = `${MONTH_NAMES_TR[month - 1]}-${year}`;
  return firm
    ? `${firm}-${period} Müşteri Memnuniyet Raporu`
    : `${period} Müşteri Memnuniyet Raporu`;
}

export function previousCalendarMonth(now = new Date()): { year: number; month: number } {
  const month = now.getMonth() === 0 ? 12 : now.getMonth();
  const year = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
  return { year, month };
}

export function canApproveSurveyMonthlyReport(roleCode?: string | null): boolean {
  const code = String(roleCode ?? '').trim().toLowerCase();
  return code === 'admin' || code === 'manager';
}

@Injectable()
export class SurveyReportService {
  private readonly logger = new Logger(SurveyReportService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
  ) {}

  private addMonthlyTarget(
    targets: MonthlyReportTarget[],
    seen: Set<string>,
    target: MonthlyReportTarget,
  ) {
    const email = String(target.email ?? '').trim().toLowerCase();
    if (!email || seen.has(email)) return;
    seen.add(email);
    targets.push({ ...target, email });
  }

  /** Sigorta + asistans + eksper + broker — aynı yönetici onayı kuralı. */
  private async collectMonthlyReportTargets(): Promise<MonthlyReportTarget[]> {
    const targets: MonthlyReportTarget[] = [];
    const seen = new Set<string>();

    const companies = await this.prisma.insuranceCompany.findMany({
      where: { status: 'active', contactEmail: { not: null } },
    });
    for (const company of companies) {
      if (!company.contactEmail) continue;
      this.addMonthlyTarget(targets, seen, {
        kind: 'insurance',
        name: company.name,
        email: company.contactEmail,
        campaignWhere: { insuranceCompanyId: company.id },
      });
    }

    const assistants = await this.prisma.customer.findMany({
      where: { status: 'active', subType: 'asistan_firmasi' },
      select: { id: true, companyName: true, fullName: true, shortName: true, email: true },
    });
    for (const firm of assistants) {
      const name = firmName(firm) || 'Asistans firması';
      const campaignWhere: SurveyCampaignScope = { emergencyCase: { customerId: firm.id } };
      if (firm.email) {
        this.addMonthlyTarget(targets, seen, {
          kind: 'assistance',
          name,
          email: firm.email,
          campaignWhere,
        });
      }
    }

    const assistanceUsers = await this.prisma.user.findMany({
      where: { status: 'active', role: { code: 'assistance_company_user' } },
      select: {
        email: true,
        firstName: true,
        lastName: true,
        userAssistantCustomerScopes: {
          select: {
            customerId: true,
            customer: { select: { companyName: true, fullName: true, shortName: true } },
          },
        },
      },
    });
    for (const user of assistanceUsers) {
      const ids = user.userAssistantCustomerScopes.map((s) => s.customerId);
      if (!ids.length) continue;
      const scopedFirm = user.userAssistantCustomerScopes[0]?.customer;
      this.addMonthlyTarget(targets, seen, {
        kind: 'assistance',
        name: firmName(scopedFirm) || `${user.firstName} ${user.lastName}`.trim() || 'Asistans firması',
        email: user.email,
        campaignWhere: { emergencyCase: { customerId: { in: ids } } },
      });
    }

    const expertOffices = await this.prisma.customer.findMany({
      where: { status: 'active', subType: { in: ['eksper_firmasi', 'eksper'] } },
      select: { id: true, companyName: true, fullName: true, shortName: true, email: true },
    });
    for (const office of expertOffices) {
      if (!office.email) continue;
      this.addMonthlyTarget(targets, seen, {
        kind: 'expert',
        name: firmName(office) || 'Eksper firması',
        email: office.email,
        campaignWhere: {
          claimFile: {
            OR: [
              { customerId: office.id },
              { repairReports: { some: { expertOfficeId: office.id } } },
            ],
          },
        },
      });
    }

    const expertUsers = await this.prisma.user.findMany({
      where: { status: 'active', role: { code: 'expert' } },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        adjuster: { select: { company: true } },
      },
    });
    for (const user of expertUsers) {
      this.addMonthlyTarget(targets, seen, {
        kind: 'expert',
        name: user.adjuster?.company?.trim() || `${user.firstName} ${user.lastName}`.trim() || 'Eksper',
        email: user.email,
        campaignWhere: {
          claimFile: {
            OR: [
              { assignedAdjusterId: user.id },
              {
                sourceChannel: 'expert_portal',
                repairReports: { some: { createdByUserId: user.id } },
              },
            ],
          },
        },
      });
    }

    const brokers = await this.prisma.customer.findMany({
      where: { status: 'active', subType: 'broker_firmasi' },
      select: { id: true, companyName: true, fullName: true, shortName: true, email: true },
    });
    for (const firm of brokers) {
      if (!firm.email) continue;
      this.addMonthlyTarget(targets, seen, {
        kind: 'broker',
        name: firmName(firm) || 'Broker firması',
        email: firm.email,
        campaignWhere: { claimFile: { customerId: firm.id } },
      });
    }

    const brokerUsers = await this.prisma.user.findMany({
      where: { status: 'active', role: { code: 'broker_user' } },
      select: {
        email: true,
        firstName: true,
        lastName: true,
        userInsuranceCompanyScopes: { select: { insuranceCompanyId: true } },
      },
    });
    for (const user of brokerUsers) {
      const insuranceIds = user.userInsuranceCompanyScopes.map((s) => s.insuranceCompanyId);
      if (!insuranceIds.length) continue;
      this.addMonthlyTarget(targets, seen, {
        kind: 'broker',
        name: `${user.firstName} ${user.lastName}`.trim() || 'Broker',
        email: user.email,
        campaignWhere: { insuranceCompanyId: { in: insuranceIds } },
      });
    }

    return targets;
  }

  async generateMonthlyReport(
    year: number,
    month: number,
    campaignWhere: SurveyCampaignScope,
    recipientName: string,
    recipientEmail: string,
  ): Promise<SurveyReportData | null> {
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 1);

    const campaigns = await this.prisma.surveyCampaign.findMany({
      where: {
        AND: [campaignWhere, { createdAt: { gte: startDate, lt: endDate } }],
      },
      include: { response: true },
    });

    const totalSent = campaigns.length;
    const completed = campaigns.filter((c) => c.response !== null);
    const totalCompleted = completed.length;
    const responseRate = totalSent > 0 ? (totalCompleted / totalSent) * 100 : 0;

    if (totalCompleted === 0) {
      return null;
    }

    const responses = completed.map((c) => c.response!);

    const avg = (arr: number[]) =>
      arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;

    const averages = {
      q1: avg(responses.map((r) => r.q1Rating)),
      q2: avg(responses.map((r) => r.q2Rating)),
      q3: avg(responses.map((r) => r.q3Rating)),
      q4: avg(responses.map((r) => r.q4Rating)),
      q5: avg(responses.map((r) => r.q5Rating)),
      overall: 0,
    };
    averages.overall =
      (averages.q1 + averages.q2 + averages.q3 + averages.q4 + averages.q5) / 5;

    const recommendCount = responses.filter((r) => r.q6Recommend).length;
    const recommendRate = (recommendCount / totalCompleted) * 100;

    const trend: SurveyReportData['trend'] = [];
    for (let i = 5; i >= 0; i--) {
      const tMonth = month - i;
      const adjustedYear = tMonth <= 0 ? year - 1 : year;
      const adjustedMonth = tMonth <= 0 ? tMonth + 12 : tMonth;

      const tStart = new Date(adjustedYear, adjustedMonth - 1, 1);
      const tEnd = new Date(adjustedYear, adjustedMonth, 1);

      const tCampaigns = await this.prisma.surveyCampaign.findMany({
        where: {
          AND: [
            campaignWhere,
            { createdAt: { gte: tStart, lt: tEnd } },
            { status: 'completed' },
          ],
        },
        include: { response: true },
      });

      const tResponses = tCampaigns
        .filter((c) => c.response !== null)
        .map((c) => c.response!);

      const tOverall =
        tResponses.length > 0
          ? avg(
              tResponses.map(
                (r) =>
                  (r.q1Rating + r.q2Rating + r.q3Rating + r.q4Rating + r.q5Rating) / 5,
              ),
            )
          : 0;

      trend.push({
        period: `${MONTH_NAMES_TR[adjustedMonth - 1]} ${adjustedYear}`,
        overall: tOverall,
        count: tResponses.length,
      });
    }

    const withComments = responses.filter(
      (r) => r.q7Comment && r.q7Comment.trim().length > 10,
    );
    const avgScore = (r: (typeof responses)[0]) =>
      (r.q1Rating + r.q2Rating + r.q3Rating + r.q4Rating + r.q5Rating) / 5;

    const highlights = withComments
      .filter((r) => avgScore(r) >= 4)
      .sort((a, b) => avgScore(b) - avgScore(a))
      .slice(0, 3)
      .map((r) => r.q7Comment!);

    const lowScoreComments = withComments
      .filter((r) => avgScore(r) < 3)
      .slice(0, 3)
      .map((r) => r.q7Comment!);

    return {
      period: `${MONTH_NAMES_TR[month - 1]} ${year}`,
      year,
      month,
      insuranceCompanyName: recipientName,
      insuranceCompanyEmail: recipientEmail,
      totalSent,
      totalCompleted,
      responseRate,
      averages,
      recommendRate,
      trend,
      highlights,
      lowScoreComments,
    };
  }

  async sendMonthlyReports(year: number, month: number): Promise<void> {
    const targets = await this.collectMonthlyReportTargets();

    this.logger.log(
      `Aylık anket raporu gönderimi başladı — ${MONTH_NAMES_TR[month - 1]} ${year} — ${targets.length} alıcı (sigorta, asistans, eksper, broker)`,
    );

    let sent = 0;
    let skipped = 0;

    for (const target of targets) {
      try {
        const reportData = await this.generateMonthlyReport(
          year,
          month,
          target.campaignWhere,
          target.name,
          target.email,
        );
        if (!reportData) {
          this.logger.debug(`Rapor verisi yok, atlanıyor → ${target.name}`);
          skipped++;
          continue;
        }

        const html = buildSurveyReportHtml(reportData);
        const subject = monthlySurveyReportSubject(target.name, month, year);

        const sentMail = await this.emailService.sendEmail(target.email, subject, html);
        if (!sentMail.sent) {
          this.logger.error(`Rapor gönderilemedi → ${target.name}: ${sentMail.errorMsg ?? 'kutu reddi'}`);
          continue;
        }
        sent++;
        this.logger.log(`Rapor gönderildi → ${target.name} (${target.email})`);
      } catch (err: any) {
        this.logger.error(`Rapor gönderilemedi → ${target.name}: ${err.message}`);
      }
    }

    this.logger.log(
      `Aylık rapor tamamlandı — gönderilen: ${sent}, atlanan: ${skipped}`,
    );
  }

  async periodHasReportData(year: number, month: number): Promise<boolean> {
    const targets = await this.collectMonthlyReportTargets();
    for (const target of targets) {
      const data = await this.generateMonthlyReport(
        year,
        month,
        target.campaignWhere,
        target.name,
        target.email,
      );
      if (data) return true;
    }
    return false;
  }

  async getOrPrepareMonthlyDispatch(now = new Date()) {
    const { year, month } = previousCalendarMonth(now);
    const period = `${MONTH_NAMES_TR[month - 1]} ${year}`;
    const hasData = await this.periodHasReportData(year, month);
    if (!hasData) {
      return {
        year,
        month,
        period,
        status: 'empty' as const,
        canAsk: false,
        canApprove: false,
      };
    }

    let row = await this.prisma.surveyMonthlyDispatch.findUnique({
      where: { year_month: { year, month } },
    });
    if (!row) {
      row = await this.prisma.surveyMonthlyDispatch.create({
        data: { year, month, status: 'ready' },
      });
    }

    return {
      year,
      month,
      period,
      status: row.status,
      canAsk: row.status === 'ready',
      canApprove: row.status === 'ready' || row.status === 'requested',
      requestedAt: row.requestedAt,
      sentAt: row.sentAt,
    };
  }

  async requestMonthlySend(userId: string, now = new Date()) {
    const snapshot = await this.getOrPrepareMonthlyDispatch(now);
    if (snapshot.status === 'empty') {
      throw new BadRequestException('Bu dönem için gönderilecek anket raporu yok.');
    }
    if (snapshot.status === 'sent') {
      throw new BadRequestException('Bu dönem raporu zaten gönderildi.');
    }
    if (snapshot.status === 'requested') {
      return snapshot;
    }
    await this.prisma.surveyMonthlyDispatch.update({
      where: { year_month: { year: snapshot.year, month: snapshot.month } },
      data: {
        status: 'requested',
        requestedByUserId: userId,
        requestedAt: now,
      },
    });
    return this.getOrPrepareMonthlyDispatch(now);
  }

  async approveMonthlySend(userId: string, roleCode: string | null | undefined, now = new Date()) {
    if (!canApproveSurveyMonthlyReport(roleCode)) {
      throw new ForbiddenException('Yönetici onayı olmadan anket raporu gönderilemez.');
    }
    const snapshot = await this.getOrPrepareMonthlyDispatch(now);
    if (snapshot.status === 'empty') {
      throw new BadRequestException('Bu dönem için gönderilecek anket raporu yok.');
    }
    if (snapshot.status === 'sent') {
      throw new BadRequestException('Bu dönem raporu zaten gönderildi.');
    }
    await this.sendMonthlyReports(snapshot.year, snapshot.month);
    await this.prisma.surveyMonthlyDispatch.update({
      where: { year_month: { year: snapshot.year, month: snapshot.month } },
      data: {
        status: 'sent',
        approvedByUserId: userId,
        approvedAt: now,
        sentAt: now,
      },
    });
    return this.getOrPrepareMonthlyDispatch(now);
  }
}
