import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { BullModule } from '@nestjs/bull';
import { HttpModule } from '@nestjs/axios';
import { PrismaModule } from '@/prisma/prisma.module';
import { LogoIntegrationController } from './logo-integration.controller';
import { LogoConfigService } from './services/logo-config.service';
import { LogoApiClientService } from './services/logo-api-client.service';
import { LogoMappingService } from './services/logo-mapping.service';
import { LogoSyncService, LOGO_SYNC_QUEUE } from './services/logo-sync.service';
import { LogoSyncProcessor } from './processors/logo-sync.processor';
import { FinanceModule } from '../finance/finance.module';

@Module({
  imports: [
    ConfigModule,
    PrismaModule,
    FinanceModule,
    BullModule.registerQueue({ name: LOGO_SYNC_QUEUE }),
    HttpModule.register({ timeout: 15_000, maxRedirects: 3 }),
  ],
  controllers: [LogoIntegrationController],
  providers: [
    LogoConfigService,
    LogoApiClientService,
    LogoMappingService,
    LogoSyncService,
    LogoSyncProcessor,
  ],
  exports: [LogoSyncService],
})
export class LogoIntegrationModule {}
