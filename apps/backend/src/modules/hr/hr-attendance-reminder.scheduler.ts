import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { HrAttendanceReminderService } from './hr-attendance-reminder.service';

@Injectable()
export class HrAttendanceReminderScheduler {
  private readonly logger = new Logger(HrAttendanceReminderScheduler.name);

  constructor(private readonly reminderService: HrAttendanceReminderService) {}

  /** Her gün 09:00 — ay sonu puantaj personel + finans/denetim hatırlatması */
  @Cron('0 9 * * *', { name: 'hr-attendance-month-close', timeZone: 'Europe/Istanbul' })
  async handleDailyReminders() {
    this.logger.log('Puantaj ay kapanış hatırlatması başladı...');
    try {
      const result = await this.reminderService.processDailyReminders();
      this.logger.log(
        `Puantaj hatırlatma tamamlandı: personel=${result.employeeSent}, finans=${result.financeSent}`,
      );
    } catch (err) {
      this.logger.error(`Puantaj hatırlatma hatası: ${err}`);
    }
  }
}
