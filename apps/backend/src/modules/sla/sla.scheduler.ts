import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { SlaService } from './sla.service';

@Injectable()
export class SlaScheduler {
  private readonly logger = new Logger(SlaScheduler.name);

  constructor(private slaService: SlaService) {}

  @Cron(CronExpression.EVERY_DAY_AT_8AM)
  async handleDailySlaCheck() {
    this.logger.log('Günlük SLA ihlal kontrolü çalıştırılıyor...');
    await this.slaService.checkViolations();
  }
}
