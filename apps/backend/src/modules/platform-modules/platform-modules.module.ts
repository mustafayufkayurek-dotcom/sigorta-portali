import { Module } from '@nestjs/common';
import { PrismaModule } from '@/prisma/prisma.module';
import { PlatformModulesService } from './platform-modules.service';
import { PlatformModulesController } from './platform-modules.controller';

@Module({
  imports: [PrismaModule],
  controllers: [PlatformModulesController],
  providers: [PlatformModulesService],
  exports: [PlatformModulesService],
})
export class PlatformModulesModule {}
