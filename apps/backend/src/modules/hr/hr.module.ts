import { Module } from '@nestjs/common';
import { PlatformModulesModule } from '@/modules/platform-modules/platform-modules.module';
import { HrController } from './hr.controller';
import { PlatformModuleGuard } from '@/common/guards/platform-module.guard';

@Module({
  imports: [PlatformModulesModule],
  controllers: [HrController],
  providers: [PlatformModuleGuard],
})
export class HrModule {}
