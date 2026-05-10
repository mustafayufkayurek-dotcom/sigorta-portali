import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { VendorContractsService } from '../vendor-contracts.service';

@Injectable()
export class ContractReminderScheduler {
  private readonly logger = new Logger(ContractReminderScheduler.name);

  constructor(private readonly contractsService: VendorContractsService) {}

  @Cron('0 9 * * *', { name: 'contract-reminders', timeZone: 'Europe/Istanbul' })
  async handleDailyReminders() {
    this.logger.log('Tedarikçi sözleşme hatırlatma görevi başladı...');
    try {
      const result = await this.contractsService.processDailyReminders();
      this.logger.log(`Hatırlatma tamamlandı: ${result.sent}/${result.total}`);
    } catch (err) {
      this.logger.error(`Hatırlatma görevi hata: ${err}`);
    }
  }
}
