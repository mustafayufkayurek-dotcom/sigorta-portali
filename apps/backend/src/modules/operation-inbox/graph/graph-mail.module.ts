import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { PrismaModule } from '@/prisma/prisma.module';
import { GraphAuthService } from './graph-auth.service';
import { GraphMailSyncService } from './graph-mail-sync.service';
import { GraphMailSendService } from './graph-mail-send.service';

/** Gelen kutu ve giden rapor maili aynı Microsoft 365 parçası — döngü yok. */
@Module({
  imports: [
    PrismaModule,
    HttpModule.register({ timeout: 60_000, maxRedirects: 3 }),
  ],
  providers: [GraphAuthService, GraphMailSyncService, GraphMailSendService],
  exports: [GraphAuthService, GraphMailSyncService, GraphMailSendService],
})
export class GraphMailModule {}
