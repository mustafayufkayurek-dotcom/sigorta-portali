import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { EmailService } from '@/modules/notifications/email/email.service';
import { buildSurveyReportHtml, SurveyReportData } from './survey-report.template';

const MONTH_NAMES_TR = [
  'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
  'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık',
];

@Injectable()
export class SurveyReportService {
  private readonly logger = new Logger(SurveyReportService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
  ) {}

  // ── Aylık rapor verisi üret ────────────────────────────────────────────────

  async generateMonthlyReport(
    year: number,
    month: number, // 1-12
    insuranceCompanyId: string,
  ): Promise<SurveyReportData | null> {
    const company = await this.prisma.insuranceCompany.findUnique({
      where: { id: insuranceCompanyId },
    });
    if (!company) return null;

    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 1);

    // Bu aya ait kampanyalar
    const campaigns = await this.prisma.surveyCampaign.findMany({
      where: {
        insuranceCompanyId,
        createdAt: { gte: startDate, lt: endDate },
      },
      include: { response: true },
    });

    const totalSent = campaigns.length;
    const completed = campaigns.filter((c) => c.response !== null);
    const totalCompleted = completed.length;
    const responseRate = totalSent > 0 ? (totalCompleted / totalSent) * 100 : 0;

    if (totalCompleted === 0) {
      return null; // Veri yoksa rapor gönderme
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

    // Son 6 ay trend
    const trend: SurveyReportData['trend'] = [];
    for (let i = 5; i >= 0; i--) {
      const tMonth = month - i;
      const adjustedYear = tMonth <= 0 ? year - 1 : year;
      const adjustedMonth = tMonth <= 0 ? tMonth + 12 : tMonth;

      const tStart = new Date(adjustedYear, adjustedMonth - 1, 1);
      const tEnd = new Date(adjustedYear, adjustedMonth, 1);

      const tCampaigns = await this.prisma.surveyCampaign.findMany({
        where: {
          insuranceCompanyId,
          createdAt: { gte: tStart, lt: tEnd },
          status: 'completed',
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

    // Yorumlar
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
      insuranceCompanyName: company.name,
      insuranceCompanyEmail: company.contactEmail ?? '',
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

  // ── Tüm sigorta şirketlerine aylık rapor gönder ───────────────────────────

  async sendMonthlyReports(year: number, month: number): Promise<void> {
    const companies = await this.prisma.insuranceCompany.findMany({
      where: { status: 'active', contactEmail: { not: null } },
    });

    this.logger.log(
      `Aylık anket raporu gönderimi başladı — ${MONTH_NAMES_TR[month - 1]} ${year} — ${companies.length} şirket`,
    );

    let sent = 0;
    let skipped = 0;

    for (const company of companies) {
      if (!company.contactEmail) {
        skipped++;
        continue;
      }

      try {
        const reportData = await this.generateMonthlyReport(year, month, company.id);
        if (!reportData) {
          this.logger.debug(`Rapor verisi yok, atlanıyor → ${company.name}`);
          skipped++;
          continue;
        }

        const html = buildSurveyReportHtml(reportData);
        const subject = `Meridyen Assistance – ${reportData.period} Müşteri Memnuniyet Raporu`;

        await this.emailService.sendEmail(company.contactEmail, subject, html);
        sent++;
        this.logger.log(`Rapor gönderildi → ${company.name} (${company.contactEmail})`);
      } catch (err: any) {
        this.logger.error(`Rapor gönderilemedi → ${company.name}: ${err.message}`);
      }
    }

    this.logger.log(
      `Aylık rapor tamamlandı — gönderilen: ${sent}, atlanan: ${skipped}`,
    );
  }
}
