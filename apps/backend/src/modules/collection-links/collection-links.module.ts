import { Module } from '@nestjs/common';
import { PaymentsModule } from '../payments/payments.module';
import {
  CollectionLinksController,
  CollectionLinksPublicController,
  PaymentWebhooksController,
} from './collection-links.controller';
import { CollectionLinksService } from './collection-links.service';
import { PaytrService } from './paytr.service';

@Module({
  imports: [PaymentsModule],
  controllers: [CollectionLinksController, CollectionLinksPublicController, PaymentWebhooksController],
  providers: [CollectionLinksService, PaytrService],
  exports: [CollectionLinksService],
})
export class CollectionLinksModule {}
