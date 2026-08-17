import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { SurveyReportService } from './survey-report.service';

@Injectable()
export class SurveyReportScheduler {
  private readonly logger = new Logger(SurveyReportScheduler.name);

  constructor(private readonly reportService: SurveyReportService) {}

  /**
   * Her ayın 1'inde saat 09:00'da (İstanbul) önceki ayın raporu gönderilir.
   */
  @Cron('0 9 1 * *', { name: 'survey-monthly-report', timeZone: 'Europe/Istanbul' })
  async handleMonthlyReport() {
    const now = new Date();
    // Önceki ayı hesapla
    const prevMonth = now.getMonth() === 0 ? 12 : now.getMonth();
    const prevYear = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();

    this.logger.log(
      `Aylık anket raporu scheduler tetiklendi → ${prevMonth}/${prevYear}`,
    );

    try {
      await this.reportService.sendMonthlyReports(prevYear, prevMonth);
    } catch (err: any) {
      this.logger.error(`Aylık rapor scheduler hatası: ${err.message}`);
    }
  }
}
