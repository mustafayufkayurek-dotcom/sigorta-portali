import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { SurveyReportService } from './survey-report.service';

@Injectable()
export class SurveyReportScheduler {
  private readonly logger = new Logger(SurveyReportScheduler.name);

  constructor(private readonly reportService: SurveyReportService) {}

  /**
   * Her ayın 1'inde saat 09:00'da (İstanbul) önceki ayın raporu hazırlanır.
   * Mail gitmez; personel Anket Sonuçları'nda sorulur, yönetici onayından sonra gider.
   */
  @Cron('0 9 1 * *', { name: 'survey-monthly-report', timeZone: 'Europe/Istanbul' })
  async handleMonthlyReport() {
    this.logger.log('Aylık anket raporu scheduler: gönderim yok, hazırlık sorusu açılır');
    try {
      await this.reportService.getOrPrepareMonthlyDispatch();
    } catch (err: any) {
      this.logger.error(`Aylık rapor scheduler hatası: ${err.message}`);
    }
  }
}
