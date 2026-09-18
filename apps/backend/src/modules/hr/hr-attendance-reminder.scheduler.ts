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

  /** Hafta içi 18:05 — gün sonu onaylamayanlara mail + yönetici çanı */
  @Cron('5 18 * * 1-5', { name: 'hr-attendance-day-end-weekday', timeZone: 'Europe/Istanbul' })
  async handleWeekdayDayEnd() {
    await this.runDayEnd();
  }

  /** Cumartesi 13:05 — yarım gün mesai bitimi */
  @Cron('5 13 * * 6', { name: 'hr-attendance-day-end-saturday', timeZone: 'Europe/Istanbul' })
  async handleSaturdayDayEnd() {
    await this.runDayEnd();
  }

  /** Ayın her günü 17:10 — son günse mali müşavire toplu rapor */
  @Cron('10 17 * * *', { name: 'hr-attendance-accountant-month-end', timeZone: 'Europe/Istanbul' })
  async handleAccountantMonthEnd() {
    await this.runAccountant();
  }

  /** Ayın 1’i 09:20 — son gün kaçtıysa yakala */
  @Cron('20 9 1 * *', { name: 'hr-attendance-accountant-catchup', timeZone: 'Europe/Istanbul' })
  async handleAccountantCatchup() {
    await this.runAccountant();
  }

  private async runDayEnd() {
    this.logger.log('Gün sonu puantaj hatırlatması başladı...');
    try {
      const result = await this.reminderService.processDayEndReminders();
      this.logger.log(
        `Gün sonu puantaj tamamlandı: personel=${result.employeeSent}, yönetici=${result.managerNotified}`,
      );
    } catch (err) {
      this.logger.error(`Gün sonu puantaj hatası: ${err}`);
    }
  }

  private async runAccountant() {
    this.logger.log('Ay sonu mali müşavir puantaj raporu denendi...');
    try {
      const result = await this.reminderService.processMonthEndAccountantSend();
      this.logger.log(`Ay sonu mali müşavir: sent=${result.sent} reason=${result.reason ?? 'ok'}`);
    } catch (err) {
      this.logger.error(`Ay sonu mali müşavir hatası: ${err}`);
    }
  }
}
