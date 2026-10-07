import { Module } from '@nestjs/common';
import { ClaimDamageCategoriesController } from './claim-damage-categories.controller';
import { ClaimDamageCategoriesService } from './claim-damage-categories.service';
import { PrismaModule } from '@/prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [ClaimDamageCategoriesController],
  providers: [ClaimDamageCategoriesService],
  exports: [ClaimDamageCategoriesService],
})
export class ClaimDamageCategoriesModule {}
