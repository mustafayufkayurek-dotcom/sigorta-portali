import { Module } from '@nestjs/common';
import { PrismaModule } from '@/prisma/prisma.module';
import { OperationalAccessGrantsController } from './operational-access-grants.controller';
import { OperationalAccessGrantsService } from './operational-access-grants.service';

@Module({
  imports: [PrismaModule],
  controllers: [OperationalAccessGrantsController],
  providers: [OperationalAccessGrantsService],
  exports: [OperationalAccessGrantsService],
})
export class OperationalAccessGrantsModule {}
