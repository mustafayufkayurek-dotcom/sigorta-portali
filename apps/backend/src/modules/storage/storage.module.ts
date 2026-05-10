import { Module } from '@nestjs/common';
import { StorageService } from './storage.service';
import { ImageOptimizerService } from './image-optimizer.service';

@Module({
  providers: [StorageService, ImageOptimizerService],
  exports: [StorageService, ImageOptimizerService],
})
export class StorageModule {}
