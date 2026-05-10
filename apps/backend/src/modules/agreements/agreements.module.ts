import { Module } from '@nestjs/common';
import { PrismaModule } from '@/prisma/prisma.module';
import { AgreementsService } from './agreements.service';
import { AgreementsController } from './agreements.controller';

@Module({
  imports: [PrismaModule],
  controllers: [AgreementsController],
  providers: [AgreementsService],
  exports: [AgreementsService],
})
export class AgreementsModule {}
