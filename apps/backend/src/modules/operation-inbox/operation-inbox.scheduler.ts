import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { OperationInboxService } from './operation-inbox.service';
import { GraphSubscriptionService } from './graph/graph-subscription.service';

@Injectable()
export class OperationInboxScheduler {
  private readonly logger = new Logger(OperationInboxScheduler.name);

  constructor(
    private readonly inboxService: OperationInboxService,
    private readonly graphSubscriptions: GraphSubscriptionService,
  ) {}

  /** Her 10 dakikada delta sync (M365 etkinse) */
  @Cron('0 */10 * * * *')
  async runScheduledSync() {
    const result = await this.inboxService.triggerSync({ scheduled: true });
    if (result.ok) {
      this.logger.log(`Planlı gelen kutusu sync: ${result.mailboxes?.join(', ')}`);
    }
  }

  /** Graph webhook aboneliklerini günlük yenile */
  @Cron('0 0 6 * * *')
  async renewGraphSubscriptions() {
    const result = await this.graphSubscriptions.ensureSubscriptions();
    if (result.ok) {
      this.logger.log(`Graph abonelik kontrolü: ${result.message}`);
    }
  }
}
