import { Module } from '@nestjs/common';
import { EntityDocumentsController } from './entity-documents.controller';
import { EntityDocumentsService } from './entity-documents.service';
import { StorageModule } from '@/modules/storage/storage.module';

@Module({
  imports: [StorageModule],
  controllers: [EntityDocumentsController],
  providers: [EntityDocumentsService],
  exports: [EntityDocumentsService],
})
export class EntityDocumentsModule {}
