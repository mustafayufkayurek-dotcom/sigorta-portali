import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { UserLocationsService } from './user-locations.service';

@Injectable()
export class LocationCleanupScheduler {
  private readonly logger = new Logger(LocationCleanupScheduler.name);

  constructor(private readonly locationsService: UserLocationsService) {}

  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async cleanOldLocations() {
    this.logger.log('30 günden eski konum kayıtları temizleniyor...');
    const deleted = await this.locationsService.cleanOldLocations();
    this.logger.log(`${deleted} eski konum kaydı silindi`);
  }
}
