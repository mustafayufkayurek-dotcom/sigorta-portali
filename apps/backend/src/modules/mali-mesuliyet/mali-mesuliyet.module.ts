import { Module } from '@nestjs/common';
import { PrismaModule } from '@/prisma/prisma.module';
import { MaliMesuliyetController } from './mali-mesuliyet.controller';
import { PublicMaliMesuliyetController } from './public-mali-mesuliyet.controller';
import { MaliMesuliyetService } from './mali-mesuliyet.service';

@Module({
  imports: [PrismaModule],
  controllers: [MaliMesuliyetController, PublicMaliMesuliyetController],
  providers: [MaliMesuliyetService],
  exports: [MaliMesuliyetService],
})
export class MaliMesuliyetModule {}
