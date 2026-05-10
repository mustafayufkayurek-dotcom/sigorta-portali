import { Module } from '@nestjs/common';
import { PrismaModule } from '@/prisma/prisma.module';
import { DamageRepairTemplatesController } from './damage-repair-templates.controller';
import { DamageRepairTemplatesService } from './damage-repair-templates.service';

@Module({
  imports: [PrismaModule],
  controllers: [DamageRepairTemplatesController],
  providers: [DamageRepairTemplatesService],
  exports: [DamageRepairTemplatesService],
})
export class DamageRepairTemplatesModule {}