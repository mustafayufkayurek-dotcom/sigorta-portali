import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { VendorRiskService } from './vendor-risk.service';
import { PrismaService } from '@/prisma/prisma.service';

@Injectable()
export class VendorRiskScheduler {
  private readonly logger = new Logger(VendorRiskScheduler.name);

  constructor(
    private readonly riskService: VendorRiskService,
    private prisma: PrismaService,
  ) {}

  // Her gün gece 02:00'de risk skorlarını yeniden hesapla
  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async recalculateAllRiskScores() {
    this.logger.log('Starting nightly risk score recalculation...');
    const result = await this.riskService.recalculateAll();
    this.logger.log(`Nightly recalculation complete: ${result.updated}/${result.total}`);
  }

  // Her Pazartesi sabah 03:00'de yoğunlaşma snapshot'larını güncelle
  @Cron('0 3 * * 1')
  async updateConcentrationSnapshots() {
    this.logger.log('Starting weekly concentration snapshot update...');
    const workGroups = await this.prisma.workGroup.findMany({
      where: { status: 'active' },
      select: { id: true },
    });

    let updated = 0;
    for (const wg of workGroups) {
      try {
        await this.riskService.updateConcentrationSnapshot(wg.id);
        updated++;
      } catch (err) {
        this.logger.error(`Failed to update concentration for workGroup ${wg.id}: ${err}`);
      }
    }

    this.logger.log(`Concentration snapshots updated for ${updated}/${workGroups.length} work groups`);
  }
}
