import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { MonthlyOverheadService } from './monthly-overhead.service';

@Injectable()
export class OverheadMonthEndScheduler {
  private readonly logger = new Logger(OverheadMonthEndScheduler.name);

  constructor(private readonly overheadService: MonthlyOverheadService) {}

  @Cron('0 9 * * *', { name: 'overhead-month-end-pool', timeZone: 'Europe/Istanbul' })
  async handleLastDayReminder() {
    this.logger.log('Yönetim gideri ay sonu hatırlatması kontrol ediliyor...');
    try {
      const result = await this.overheadService.sendLastDayPoolReminders();
      this.logger.log(
        `Ay sonu havuz hatırlatması: panel=${result.sent}, e-posta=${result.emailed}${
          result.skipped ? `, atlandı=${result.skipped}` : ''
        }`,
      );
    } catch (err) {
      this.logger.error(`Ay sonu havuz hatırlatması hata: ${err}`);
    }
  }
}
