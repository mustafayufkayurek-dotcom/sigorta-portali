import { Processor, Process } from '@nestjs/bull';
import { Job } from 'bull';
import { PrismaService } from '@/prisma/prisma.service';
import { CustomerAccessLogService } from './customer-access-log.service';
import { LogAccessDto } from './dto/log-access.dto';

@Processor('customer-access')
export class CustomerAccessLogProcessor {
  constructor(
    private prisma: PrismaService,
    private accessLogService: CustomerAccessLogService,
  ) {}

  @Process('log-access')
  async handleLogAccess(job: Job<LogAccessDto>): Promise<void> {
    const { userId, customerId, claimFileId, accessType, ipAddress, userAgent } = job.data;

    try {
      const log = await this.prisma.customerAccessLog.create({
        data: {
          userId,
          customerId,
          claimFileId: claimFileId ?? null,
          accessType,
          ipAddress: ipAddress ?? null,
          userAgent: userAgent ?? null,
        },
      });

      await this.accessLogService.detectAndAlertAnomaly(log.id, userId);
    } catch {
      // Loglama hataları sessizce geçirilir; uygulama akışını bozmamalı
    }
  }
}
